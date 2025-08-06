import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory, ECPairInterface } from 'ecpair';
import { getNetworkConfig, NetworkType } from './config';
import { Request } from './request';
import * as wif from 'wif';
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

export interface UTXO {
  tx_hash: string;
  tx_output_n: number;
  value: number;
  script: string;
}

export async function getBTCAccount(
  input: string,
  networkType: NetworkType,
  addressType: 'p2wpkh' | 'p2tr' = 'p2tr'
) {
  const { network } = getNetworkConfig(networkType);
  let keyPair: ECPairInterface;
  let xOnlyPubkey: Buffer | undefined;
  let address: string;

  try {
    if (input.trim().split(' ').length >= 12) {
      if (!bip39.validateMnemonic(input)) {
        throw new Error('无效的助记词');
      }

      const seed = bip39.mnemonicToSeedSync(input);
      const root = bip32.BIP32Factory(ecc).fromSeed(seed, network);

      const derivationPath = addressType === 'p2wpkh'
        ? "m/84'/0'/0'/0/0"
        : "m/86'/0'/0'/0/0";

      const child = root.derivePath(derivationPath);
      if (!child.privateKey) throw new Error('助记词派生私钥失败');

      keyPair = ECPair.fromPrivateKey(child.privateKey, { network });
    } else {
      if (!input.match(/^[5KLc9][1-9A-HJ-NP-Za-km-z]{50,51}$/)) {
        throw new Error('无效的 WIF 格式');
      }

      const decoded = wif.decode(input);
      if (decoded.version !== network.wif) {
        throw new Error(`WIF 网络版本不匹配，预期: ${network.wif}, 实际: ${decoded.version}`);
      }

      const privateKey = Buffer.from(decoded.privateKey);
      keyPair = ECPair.fromPrivateKey(privateKey, { network });
    }

    const publicKey = keyPair.publicKey;
    if (!publicKey || publicKey.length < 33) {
      throw new Error(`公钥无效，长度: ${publicKey?.length}`);
    }

    if (addressType === 'p2tr') {
      xOnlyPubkey = publicKey.slice(1, 33);
      if (xOnlyPubkey.length !== 32) {
        throw new Error(`xOnlyPubkey 长度不为 32，实际: ${xOnlyPubkey.length}`);
      }

      const result = bitcoin.payments.p2tr({ internalPubkey: xOnlyPubkey, network });
      if (!result.address) throw new Error('生成 Taproot 地址失败');
      address = result.address;
    } else {
      const result = bitcoin.payments.p2wpkh({ pubkey: publicKey, network });
      if (!result.address) throw new Error('生成 P2WPKH 地址失败');
      address = result.address;
    }

    return { address, keyPair, xOnlyPubkey };
  } catch (err) {
    console.error('getBTCAccount 出错:', err);
    if (err instanceof Error) {
      console.error('错误信息:', err.message);
      console.error('错误栈:', err.stack);
    }
    throw err;
  }
}


export async function fetchUTXOs(address: string, networkType: NetworkType): Promise<UTXO[]> {
  const config = getNetworkConfig(networkType);
  const api = new Request(config.unisatWalletUri, config.mempoolUri);
  const utxosRaw = await api.getUTXO(address);

  return utxosRaw.map((u: any) => ({
    tx_hash: u.txid,
    tx_output_n: u.vout,
    value: u.satoshi,
    script: u.scriptPk || '',
  }));
}

export async function mergeSelectedUTXOs(params: {
  keyPair: ECPairInterface,
  xOnlyPubkey?: Buffer,
  utxos: UTXO[],
  satsPerVbyte: number,
  targetAddress: string,
  networkType: NetworkType,
  addressType: 'p2wpkh' | 'p2tr',
}): Promise<string> {
  const {
    keyPair,
    xOnlyPubkey,
    utxos,
    satsPerVbyte,
    targetAddress,
    networkType,
    addressType,
  } = params;

  const { network, unisatWalletUri, mempoolUri } = getNetworkConfig(networkType);
  const request = new Request(unisatWalletUri, mempoolUri);

  // --- Phase 1: 构造估算交易 ---
  const psbtEstimate = new bitcoin.Psbt({ network });
  let totalInputValue = 0;

  for (const utxo of utxos) {
    const input: any = {
      hash: utxo.tx_hash,
      index: utxo.tx_output_n,
      sequence: 0xfffffffd,
      witnessUtxo: {
        value: utxo.value,
        script: Buffer.from(utxo.script, 'hex'),
      },
    };

    if (addressType === 'p2tr') {
      if (!xOnlyPubkey) throw new Error('缺少 xOnlyPubkey（Taproot 公钥）');
      input.tapInternalKey = xOnlyPubkey;
    }

    psbtEstimate.addInput(input);
    totalInputValue += utxo.value;
  }

  psbtEstimate.addOutput({
    address: targetAddress,
    value: totalInputValue, // placeholder
  });

  if (addressType === 'p2tr') {
    const signer = keyPair.tweak(
      bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey!)
    );
    psbtEstimate.data.inputs.forEach((_, i) => psbtEstimate.signInput(i, signer));
  } else {
    psbtEstimate.signAllInputs(keyPair);
  }

  psbtEstimate.finalizeAllInputs();

  const estTx = psbtEstimate.extractTransaction();
  const estVSize = estTx.virtualSize();
  const fee = Math.round(estVSize * satsPerVbyte);
  const sendValue = totalInputValue - fee;

  if (sendValue <= 546) throw new Error(`Dust output after fee: ${sendValue} sats`);

  // --- Phase 2: 构造最终交易 ---
  const finalPsbt = new bitcoin.Psbt({ network });

  for (const utxo of utxos) {
    const input: any = {
      hash: utxo.tx_hash,
      index: utxo.tx_output_n,
      sequence: 0xfffffffd,
      witnessUtxo: {
        value: utxo.value,
        script: Buffer.from(utxo.script, 'hex'),
      },
    };

    if (addressType === 'p2tr') {
      input.tapInternalKey = xOnlyPubkey!;
    }

    finalPsbt.addInput(input);
  }

  finalPsbt.addOutput({
    address: targetAddress,
    value: sendValue,
  });

  if (addressType === 'p2tr') {
    const signer = keyPair.tweak(
      bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey!)
    );
    finalPsbt.data.inputs.forEach((_, i) => finalPsbt.signInput(i, signer));
  } else {
    finalPsbt.signAllInputs(keyPair);
  }

  finalPsbt.finalizeAllInputs();

  const finalTx = finalPsbt.extractTransaction();
  const txHex = finalTx.toHex();
  const txid = await request.broadcastTx(txHex);

  return txid;
}

export async function splitSelectedUTXOs(params: {
  keyPair: ECPairInterface;
  xOnlyPubkey?: Buffer;
  utxos: UTXO[];
  outputs: { address: string; value: number }[];
  satsPerVbyte: number;
  changeAddress: string;
  networkType: NetworkType;
  addressType: 'p2wpkh' | 'p2tr';
}): Promise<string> {
  const {
    keyPair,
    xOnlyPubkey,
    utxos,
    outputs,
    satsPerVbyte,
    changeAddress,
    networkType,
    addressType,
  } = params;

  const { network, unisatWalletUri, mempoolUri } = getNetworkConfig(networkType);
  const request = new Request(unisatWalletUri, mempoolUri);

  // === Phase 1: 构造估算交易 ===
  const psbtEstimate = new bitcoin.Psbt({ network });
  let totalInputValue = 0;

  for (const utxo of utxos) {
    const input: any = {
      hash: utxo.tx_hash,
      index: utxo.tx_output_n,
      sequence: 0xfffffffd,
      witnessUtxo: {
        value: utxo.value,
        script: Buffer.from(utxo.script, 'hex'),
      },
    };

    if (addressType === 'p2tr') {
      if (!xOnlyPubkey) throw new Error('缺少 xOnlyPubkey（Taproot 公钥）');
      input.tapInternalKey = xOnlyPubkey;
    }

    psbtEstimate.addInput(input);
    totalInputValue += utxo.value;
  }

  for (const output of outputs) {
    psbtEstimate.addOutput({
      address: output.address,
      value: output.value,
    });
  }

  // 添加估算用找零（value=0）
  psbtEstimate.addOutput({
    address: changeAddress,
    value: 0,
  });

  if (addressType === 'p2tr') {
    const signer = keyPair.tweak(
      bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey!)
    );
    psbtEstimate.data.inputs.forEach((_, i) => psbtEstimate.signInput(i, signer));
  } else {
    psbtEstimate.signAllInputs(keyPair);
  }

  psbtEstimate.finalizeAllInputs();

  const estTx = psbtEstimate.extractTransaction(true);
  const estVSize = estTx.virtualSize();
  const fee = Math.round(estVSize * satsPerVbyte);

  const outputSum = outputs.reduce((sum, o) => sum + o.value, 0);
  const changeValue = totalInputValue - outputSum - fee;

  if (changeValue < 0) {
    throw new Error(`余额不足：输入=${totalInputValue}，输出=${outputSum}，fee=${fee}`);
  }

  if (changeValue > 0 && changeValue < 546) {
    throw new Error(`找零金额 ${changeValue} 小于 Dust 阈值（546）`);
  }

  // === Phase 2: 构造最终交易 ===
  const psbtFinal = new bitcoin.Psbt({ network });

  for (const utxo of utxos) {
    const input: any = {
      hash: utxo.tx_hash,
      index: utxo.tx_output_n,
      sequence: 0xfffffffd,
      witnessUtxo: {
        value: utxo.value,
        script: Buffer.from(utxo.script, 'hex'),
      },
    };

    if (addressType === 'p2tr') {
      input.tapInternalKey = xOnlyPubkey!;
    }

    psbtFinal.addInput(input);
  }

  for (const output of outputs) {
    psbtFinal.addOutput({
      address: output.address,
      value: output.value,
    });
  }

  if (changeValue >= 546) {
    psbtFinal.addOutput({
      address: changeAddress,
      value: changeValue,
    });
  }

  if (addressType === 'p2tr') {
    const signer = keyPair.tweak(
      bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey!)
    );
    psbtFinal.data.inputs.forEach((_, i) => psbtFinal.signInput(i, signer));
  } else {
    psbtFinal.signAllInputs(keyPair);
  }

  psbtFinal.finalizeAllInputs();

  const finalTx = psbtFinal.extractTransaction();
  const txHex = finalTx.toHex();
  const txid = await request.broadcastTx(txHex);

  return txid;
}
