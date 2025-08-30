import { useState } from 'react';
import { getBTCAccount, fetchUTXOs, mergeSelectedUTXOs, UTXO } from '../../utils/bitcoin';
import { NetworkType, networkConfigs } from '../../utils/config';
// 导入 CSS Modules
import styles from './BTCMerge.module.css';

export default function BTCMerge() {
  const [networkType, setNetworkType] = useState<NetworkType>('testnet');
  const [inputKey, setInputKey] = useState('');
  const [utxos, setUtxos] = useState<UTXO[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [satsPerVbyte, setSatsPerVbyte] = useState('1');
  const [targetAddress, setTargetAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [txid, setTxid] = useState('');
  const [error, setError] = useState('');
  const [address, setAddress] = useState('');
  const [addressType, setAddressType] = useState<'p2tr' | 'p2wpkh'>('p2tr');

  const handleLoad = async () => {
    try {
      setError('');
      setTxid('');
      const { address } = await getBTCAccount(inputKey, networkType, addressType);
      const fetched = await fetchUTXOs(address, networkType);
      setUtxos(fetched);
      setAddress(address);
    } catch (err: any) {
      setError(err.message || '加载失败');
    }
  };

  const toggleSelect = (i: number) => {
    setSelectedIndexes(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const handleMerge = async () => {
    try {
      setLoading(true);
      setError('');
      setTxid('');
      const { keyPair, xOnlyPubkey } = await getBTCAccount(inputKey, networkType, addressType);
      const selected = selectedIndexes.map(i => utxos[i]);
      const tx = await mergeSelectedUTXOs({
        keyPair,
        xOnlyPubkey,
        utxos: selected,
        satsPerVbyte: parseFloat(satsPerVbyte),
        targetAddress,
        networkType,
        addressType,
      });
      setTxid(tx);
    } catch (e: any) {
      setError(e.message || '合并失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>比特币 UTXO 合并工具</h2>
      <p className={styles.subtitle}>通过合并多个未花费的交易输出（UTXO）来减少交易费用。</p>

      <div className={styles['form-container']}>
        <div className={styles['form-group']}>
          <label className={styles['form-label']}>选择网络</label>
          <select className={styles['form-select']} value={networkType} onChange={e => setNetworkType(e.target.value as NetworkType)}>
            {Object.keys(networkConfigs).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <div className={styles['form-group']}>
          <label className={styles['form-label']}>选择地址类型</label>
          <select className={styles['form-select']} value={addressType} onChange={e => setAddressType(e.target.value as 'p2tr' | 'p2wpkh')}>
            <option value="p2tr">Taproot (bc1p)</option>
            <option value="p2wpkh">SegWit (bc1q)</option>
          </select>
        </div>

        <div className={styles['form-group']}>
          <label className={styles['form-label']}>助记词 或 私钥(WIF)</label>
          <textarea className={styles['form-input']} value={inputKey} onChange={e => setInputKey(e.target.value)} rows={3} />
        </div>

        <button className={styles['action-button']} onClick={handleLoad}>加载地址 & UTXO</button>
        {address && <p className={styles['output-text']}>当前地址: {address}</p>}
      </div>

      {utxos.length > 0 && (
        <div className={styles['form-container']}>
          <h4 className={styles.subtitle}>选择要合并的 UTXO</h4>
          <div className={styles['utxo-list']}>
            {utxos.map((u, i) => (
              <label key={i} className={styles['utxo-item']}>
                <input type="checkbox" checked={selectedIndexes.includes(i)} onChange={() => toggleSelect(i)} />
                {u.tx_hash.slice(0, 8)}...:{u.tx_output_n} - {u.value} sats
              </label>
            ))}
          </div>
        </div>
      )}

      <div className={styles['form-container']}>
        <div className={styles['form-group']}>
          <label className={styles['form-label']}>手续费（sats/vByte）</label>
          <input
            className={styles['form-input']}
            type="number"
            step="0.01"
            value={satsPerVbyte}
            onChange={e => setSatsPerVbyte(e.target.value)}
          />
        </div>

        <div className={styles['form-group']}>
          <label className={styles['form-label']}>收款地址</label>
          <input className={styles['form-input']} value={targetAddress} onChange={e => setTargetAddress(e.target.value)} />
        </div>

        <button
          className={styles['action-button']}
          disabled={loading || selectedIndexes.length < 1}
          onClick={handleMerge}
        >
          {loading ? '合并中...' : '开始合并'}
        </button>
      </div>

      {(txid || error) && (
        <div className={styles['output-container']}>
          {txid && (
            <p className={styles['output-text']}>
              ✅ 成功广播:
              <a
                className={styles['output-link']}
                href={`${networkConfigs[networkType].mempoolUri}/tx/${txid}`}
                target="_blank"
                rel="noreferrer"
              >
                {txid}
              </a>
            </p>
          )}
          {error && <p className={styles['error-text']}>❌ {error}</p>}
        </div>
      )}
    </div>
  );
}