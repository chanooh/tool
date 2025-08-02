import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory, ECPairInterface } from 'ecpair';
import { getNetworkConfig, NetworkType } from './config';
import { Request } from './request';

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

export interface UTXO {
  tx_hash: string;
  tx_output_n: number;
  value: number;
  script: string;
}

export async function getBTCAccount(input: string, networkType: NetworkType) {
  const { network } = getNetworkConfig(networkType);
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
  if (!address) throw new Error('生成地址失败');
  return { address, keyPair, xOnlyPubkey };
}

export async function fetchUTXOs(address: string, networkType: NetworkType): Promise<UTXO[]> {
  const config = getNetworkConfig(networkType);
  const api = new Request(config.unisatWalletUri, config.mempoolUri);
  const utxosRaw = await api.getUTXO(address);

  return utxosRaw.map((u: any) => ({
    tx_hash: u.txid,
    tx_output_n: u.vout,
    value: u.satoshis,
    script: u.scriptPk || '',
  }));
}

export async function mergeSelectedUTXOs(params: {
  keyPair: ECPairInterface,
  xOnlyPubkey: Buffer,
  utxos: UTXO[],
  satsPerVbyte: number,
  targetAddress: string,
  networkType: NetworkType,
}): Promise<string> {
  const { keyPair, xOnlyPubkey, utxos, satsPerVbyte, targetAddress, networkType } = params;
  const { network, unisatWalletUri, mempoolUri } = getNetworkConfig(networkType);
  const request = new Request(unisatWalletUri, mempoolUri);

  // --- Phase 1: 构造估算交易 ---
  const psbtEstimate = new bitcoin.Psbt({ network });
  let totalInputValue = 0;

  for (const utxo of utxos) {
    psbtEstimate.addInput({
      hash: utxo.tx_hash,
      index: utxo.tx_output_n,
      sequence: 0xfffffffd,
      witnessUtxo: {
        value: utxo.value,
        script: Buffer.from(utxo.script, 'hex'),
      },
      tapInternalKey: xOnlyPubkey,
    });
    totalInputValue += utxo.value;
  }

  // 暂时添加 placeholder 输出
  psbtEstimate.addOutput({
    address: targetAddress,
    value: totalInputValue,
  });

  const signer = keyPair.tweak(
    bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey)
  );

  psbtEstimate.data.inputs.forEach((_, i) => psbtEstimate.signInput(i, signer));
  psbtEstimate.finalizeAllInputs();

  const estTx = psbtEstimate.extractTransaction();
  const estVSize = estTx.virtualSize();
  const fee = Math.round(estVSize * satsPerVbyte); // 精确四舍五入
  const sendValue = totalInputValue - fee;

  if (sendValue <= 546) throw new Error(`Dust output after fee: ${sendValue} sats`);

  console.log(`--- Fee Estimation ---`);
  console.log(`Total input: ${totalInputValue} sats`);
  console.log(`Estimated vSize: ${estVSize} vBytes`);
  console.log(`Requested fee rate: ${satsPerVbyte} sats/vByte`);
  console.log(`Calculated fee: ${fee} sats`);
  console.log(`Send value: ${sendValue} sats`);

  // --- Phase 2: 构造实际交易 ---
  const finalPsbt = new bitcoin.Psbt({ network });

  for (const utxo of utxos) {
    finalPsbt.addInput({
      hash: utxo.tx_hash,
      index: utxo.tx_output_n,
      sequence: 0xfffffffd,
      witnessUtxo: {
        value: utxo.value,
        script: Buffer.from(utxo.script, 'hex'),
      },
      tapInternalKey: xOnlyPubkey,
    });
  }

  finalPsbt.addOutput({
    address: targetAddress,
    value: sendValue,
  });

  finalPsbt.data.inputs.forEach((_, i) => finalPsbt.signInput(i, signer));
  finalPsbt.finalizeAllInputs();

  const finalTx = finalPsbt.extractTransaction();
  const realVSize = finalTx.virtualSize();
  const realFeeRate = parseFloat((fee / realVSize).toFixed(2));

  console.log(`--- Final Transaction ---`);
  console.log(`Final vSize: ${realVSize} vBytes`);
  console.log(`Actual fee rate: ${realFeeRate} sats/vByte`);

  const txHex = finalTx.toHex();
  const txid = await request.broadcastTx(txHex);
  return txid;
}
