import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory, ECPairInterface } from 'ecpair';
import axios from 'axios';
// import pLimit from 'p-limit'; // 如需并发控制，可启用

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.testnet;

export interface UTXO {
  tx_hash: string;
  tx_output_n: number;
  value: number;
  script: string;
}

// 缓存 tx script
const scriptCache: { [key: string]: string } = {};

// 可选并发控制（一次最多3个请求）
// const limit = pLimit(3);

async function getCachedScript(txid: string, index: number): Promise<string> {
  const key = `${txid}:${index}`;
  if (scriptCache[key]) return scriptCache[key];
  const res = await axios.get(`https://api.blockcypher.com/v1/btc/test3/txs/${txid}`);
  const script = res.data.outputs[index].script;
  scriptCache[key] = script;
  return script;
}

export async function getBTCAccount(input: string): Promise<{
  address: string;
  keyPair: ECPairInterface;
  xOnlyPubkey: Buffer;
}> {
  let keyPair: ECPairInterface;
  let xOnlyPubkey: Buffer;

  if (input.trim().split(' ').length >= 12) {
    const seed = bip39.mnemonicToSeedSync(input);
    const root = bip32.BIP32Factory(ecc).fromSeed(seed, network);
    const child = root.derivePath("m/86'/0'/0'/0/0");
    keyPair = ECPair.fromPrivateKey(child.privateKey!, { network });
    xOnlyPubkey = Buffer.from(child.publicKey.slice(1, 33));
  } else {
    keyPair = ECPair.fromWIF(input, network);
    const pub = keyPair.publicKey;
    xOnlyPubkey = pub.length === 32 ? pub : pub.slice(1, 33);
  }

  const { address } = bitcoin.payments.p2tr({ internalPubkey: xOnlyPubkey, network });
  if (!address) throw new Error('Address generation failed');
  return { address, keyPair, xOnlyPubkey };
}

export async function fetchUTXOs(address: string): Promise<UTXO[]> {
  const res = await axios.get(`https://api.blockcypher.com/v1/btc/test3/addrs/${address}?unspentOnly=true`);
  const utxos = res.data.txrefs || [];

  // 提前获取 script 并缓存，避免重复请求
  const enriched: UTXO[] = await Promise.all(utxos.map(async (utxo: any) => {
    const script = await getCachedScript(utxo.tx_hash, utxo.tx_output_n);
    return {
      tx_hash: utxo.tx_hash,
      tx_output_n: utxo.tx_output_n,
      value: utxo.value,
      script,
    };
  }));

  return enriched;
}

export async function mergeSelectedUTXOs(params: {
  keyPair: ECPairInterface,
  xOnlyPubkey: Buffer,
  utxos: UTXO[],
  satsPerVbyte: number,
  targetAddress: string,
}): Promise<string> {
  const { keyPair, xOnlyPubkey, utxos, satsPerVbyte, targetAddress } = params;
  const psbt = new bitcoin.Psbt({ network });
  let totalInputValue = 0;

  for (const utxo of utxos) {
    const script = utxo.script || await getCachedScript(utxo.tx_hash, utxo.tx_output_n);
    totalInputValue += utxo.value;
    psbt.addInput({
      hash: utxo.tx_hash,
      index: utxo.tx_output_n,
      sequence: 0xfffffffd,
      witnessUtxo: {
        script: Buffer.from(script, 'hex'),
        value: utxo.value,
      },
      tapInternalKey: xOnlyPubkey,
    });
  }

  psbt.addOutput({ address: targetAddress, value: totalInputValue });

  const signer = keyPair.tweak(
    bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey),
  );
  psbt.data.inputs.forEach((_, i) => psbt.signInput(i, signer));
  psbt.finalizeAllInputs();

  const vSize = psbt.extractTransaction().virtualSize();
  const fee = Math.ceil(vSize * satsPerVbyte);
  const finalValue = totalInputValue - fee;
  if (finalValue <= 546) throw new Error("Dust output after fee");

  // Rebuild tx with real output value
  const finalPsbt = new bitcoin.Psbt({ network });
  for (const utxo of utxos) {
    const script = utxo.script || await getCachedScript(utxo.tx_hash, utxo.tx_output_n);
    finalPsbt.addInput({
      hash: utxo.tx_hash,
      index: utxo.tx_output_n,
      sequence: 0xfffffffd,
      witnessUtxo: {
        script: Buffer.from(script, 'hex'),
        value: utxo.value,
      },
      tapInternalKey: xOnlyPubkey,
    });
  }

  finalPsbt.addOutput({ address: targetAddress, value: finalValue });
  finalPsbt.data.inputs.forEach((_, i) => finalPsbt.signInput(i, signer));
  finalPsbt.finalizeAllInputs();

  const txHex = finalPsbt.extractTransaction().toHex();

  const res = await axios.post(
    `https://api.blockcypher.com/v1/btc/test3/txs/push`,
    { tx: txHex },
    { headers: { 'Content-Type': 'application/json' } }
  );

  return res.data.tx && res.data.tx.hash;
}
