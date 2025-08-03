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

export async function getBTCAccount(input: string, networkType: NetworkType) {
  const { network } = getNetworkConfig(networkType);
  let keyPair: ECPairInterface;
  let xOnlyPubkey: Buffer;

  try {
    console.log('📥 输入:', input);
    if (input.trim().split(' ').length >= 12) {
      console.log('🚀 检测到输入为助记词，尝试从助记词派生私钥...');
      if (!bip39.validateMnemonic(input)) {
        throw new Error('无效的助记词');
      }
      const seed = bip39.mnemonicToSeedSync(input);
      const root = bip32.BIP32Factory(ecc).fromSeed(seed, network);
      const child = root.derivePath("m/86'/0'/0'/0/0");

      if (!child.privateKey) throw new Error('助记词派生私钥失败');

      keyPair = ECPair.fromPrivateKey(child.privateKey, { network });
      xOnlyPubkey = Buffer.from(child.publicKey.slice(1, 33));
    } else {
      console.log('🔐 尝试从 WIF 导入私钥...');
      if (!input.match(/^[5KLc9][1-9A-HJ-NP-Za-km-z]{50,51}$/)) {
        throw new Error('无效的 WIF 格式');
      }
    
      let privateKey: Buffer;
      try {
        const decoded = wif.decode(input);
        if (decoded.version !== network.wif) {
          throw new Error(`WIF 网络版本不匹配，预期: ${network.wif}, 实际: ${decoded.version}`);
        }
        privateKey = Buffer.from(decoded.privateKey); // Convert Uint8Array to Buffer
      } catch (wifError) {
        console.error('❌ WIF 解码失败:', wifError);
        throw new Error(`WIF 解码失败: ${(wifError as Error).message}`);
      }
    

      keyPair = ECPair.fromPrivateKey(privateKey, { network });
      if (!keyPair.publicKey || keyPair.publicKey.length < 33) {
        throw new Error(`公钥无效，长度: ${keyPair.publicKey?.length}`);
      }

      xOnlyPubkey = keyPair.publicKey.slice(1, 33);
      console.log('✅ 导入私钥成功，公钥:', keyPair.publicKey.toString('hex'));
      console.log('✅ xOnly 公钥:', xOnlyPubkey.toString('hex'));
      console.log('✅ xOnly 公钥长度:', xOnlyPubkey.length);
    }

    if (xOnlyPubkey.length !== 32) {
      throw new Error(`xOnlyPubkey 长度不为 32，实际: ${xOnlyPubkey.length}`);
    }

    const { address } = bitcoin.payments.p2tr({ internalPubkey: xOnlyPubkey, network });

    if (!address) {
      console.error('❌ 生成地址失败，p2tr 返回 null');
      throw new Error('生成地址失败');
    }

    console.log('✅ 生成地址成功:', address);

    return { address, keyPair, xOnlyPubkey };
  } catch (err) {
    console.error('❌ getBTCAccount 出错:', err);
    if (err instanceof Error) {
      console.error('🧵 错误信息:', err.message);
      console.error('📍 错误栈:', err.stack);
    } else {
      console.error('⚠️ 非标准错误对象:', JSON.stringify(err));
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
