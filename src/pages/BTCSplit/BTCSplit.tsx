import { useState } from 'react';
import { getBTCAccount, fetchUTXOs, splitSelectedUTXOs, UTXO } from '../../utils/bitcoin';
import { NetworkType, networkConfigs } from '../../utils/config';
import styles from './BTCSplit.module.css';

interface Output {
  address: string;
  value: string;
}

export default function BTCSplit() {
  const [networkType, setNetworkType] = useState<NetworkType>('testnet');
  const [inputKey, setInputKey] = useState('');
  const [utxos, setUtxos] = useState<UTXO[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [satsPerVbyte, setSatsPerVbyte] = useState('1');
  const [outputs, setOutputs] = useState<Output[]>([{ address: '', value: '' }]);
  const [changeAddress, setChangeAddress] = useState('');
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
      setChangeAddress(address);
    } catch (err: any) {
      setError(err.message || '加载失败');
    }
  };

  const toggleSelect = (i: number) => {
    setSelectedIndexes(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const handleSplit = async () => {
    try {
      setLoading(true);
      setError('');
      setTxid('');
      const { keyPair, xOnlyPubkey } = await getBTCAccount(inputKey, networkType, addressType);
      const selected = selectedIndexes.map(i => utxos[i]);

      const parsedOutputs = outputs
        .filter(o => o.address && o.value)
        .map(o => ({ address: o.address, value: parseInt(o.value) }));

      const tx = await splitSelectedUTXOs({
        keyPair,
        xOnlyPubkey,
        utxos: selected,
        satsPerVbyte: parseFloat(satsPerVbyte),
        outputs: parsedOutputs,
        changeAddress,
        networkType,
        addressType,
      });

      setTxid(tx);
    } catch (e: any) {
      setError(e.message || '拆分失败');
    } finally {
      setLoading(false);
    }
  };

  const updateOutput = (index: number, field: keyof Output, value: string) => {
    setOutputs(prev => {
      const copy = [...prev];
      copy[index][field] = value;
      return copy;
    });
  };

  const addOutput = () => {
    setOutputs(prev => [...prev, { address: '', value: '' }]);
  };

  const removeOutput = (index: number) => {
    setOutputs(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>比特币 UTXO 拆分工具</h2>
      <p className={styles.subtitle}>将一个或多个UTXO拆分为多个更小面额的UTXO。</p>

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
          <h4 className={styles.subtitle}>选择要使用的 UTXO</h4>
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

        <div className={styles['output-list']}>
          <label className={styles['form-label']}>输出地址和金额</label>
          {outputs.map((output, index) => (
            <div key={index} className={styles['output-row']}>
              <input
                className={styles['form-input']}
                placeholder="接收地址"
                value={output.address}
                onChange={e => updateOutput(index, 'address', e.target.value)}
              />
              <input
                className={styles['form-input']}
                type="number"
                placeholder="金额 (sats)"
                value={output.value}
                onChange={e => updateOutput(index, 'value', e.target.value)}
              />
              <button className={styles['remove-button']} onClick={() => removeOutput(index)}>移除</button>
            </div>
          ))}
          <button className={styles['add-button']} onClick={addOutput}>添加输出</button>
        </div>

        <div className={styles['form-group']}>
          <label className={styles['form-label']}>找零地址（默认当前地址）</label>
          <input className={styles['form-input']} value={changeAddress} onChange={e => setChangeAddress(e.target.value)} />
        </div>

        <button
          className={styles['action-button']}
          disabled={loading || selectedIndexes.length < 1 || outputs.length === 0 || outputs.some(o => !o.address || !o.value)}
          onClick={handleSplit}
        >
          {loading ? '拆分中...' : '开始拆分'}
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