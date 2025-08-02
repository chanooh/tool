import { useState } from 'react';
import { getBTCAccount, fetchUTXOs, mergeSelectedUTXOs, UTXO } from '../../utils/bitcoin';
import { NetworkType, networkConfigs } from '../../utils/config';

export default function BTCMerge() {
  const [networkType, setNetworkType] = useState<NetworkType>('testnet');
  const [inputKey, setInputKey] = useState('');
  const [utxos, setUtxos] = useState<UTXO[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [satsPerVbyte, setSatsPerVbyte] = useState('100');
  const [targetAddress, setTargetAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [txid, setTxid] = useState('');
  const [error, setError] = useState('');
  const [address, setAddress] = useState('');

  const handleLoad = async () => {
    try {
      setError('');
      setTxid('');
      const { address } = await getBTCAccount(inputKey, networkType);
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
      const { keyPair, xOnlyPubkey } = await getBTCAccount(inputKey, networkType);
      const selected = selectedIndexes.map(i => utxos[i]);
      const tx = await mergeSelectedUTXOs({
        keyPair,
        xOnlyPubkey,
        utxos: selected,
        satsPerVbyte: parseFloat(satsPerVbyte),
        targetAddress,
        networkType,
      });
      setTxid(tx);
    } catch (e: any) {
      setError(e.message || '合并失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="btc-container">
      <h2>比特币 UTXO 合并工具</h2>

      <div className="input-group">
        <label>选择网络</label>
        <select value={networkType} onChange={e => setNetworkType(e.target.value as NetworkType)}>
          {Object.keys(networkConfigs).map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div className="input-group">
        <label>助记词 或 私钥(WIF)</label>
        <textarea value={inputKey} onChange={e => setInputKey(e.target.value)} rows={3} />
      </div>

      <button onClick={handleLoad}>加载地址 & UTXO</button>
      {address && <p>当前地址: {address}</p>}

      {utxos.length > 0 && (
        <div className="utxo-list">
          <h4>选择要合并的 UTXO</h4>
          {utxos.map((u, i) => (
            <label key={i}>
              <input type="checkbox" checked={selectedIndexes.includes(i)} onChange={() => toggleSelect(i)} />
              {u.tx_hash.slice(0, 8)}...:{u.tx_output_n} - {u.value} sats
            </label>
          ))}
        </div>
      )}

      <div className="input-group">
        <label>手续费（sats/vByte）</label>
        <input
          type="number"
          step="0.01" // ✅ 显式允许输入小数
          value={satsPerVbyte}
          onChange={e => setSatsPerVbyte(e.target.value)}
        />
      </div>

      <div className="input-group">
        <label>收款地址</label>
        <input value={targetAddress} onChange={e => setTargetAddress(e.target.value)} />
      </div>

      <button disabled={loading || selectedIndexes.length < 1} onClick={handleMerge}>
        {loading ? '合并中...' : '开始合并'}
      </button>

      {txid && (
        <p>✅ 成功广播: 
          <a href={`${networkConfigs[networkType].mempoolUri}/tx/${txid}`} target="_blank" rel="noreferrer">
            {txid}
          </a>
        </p>
      )}
      {error && <p style={{ color: 'red' }}>❌ {error}</p>}
    </div>
  );
}
