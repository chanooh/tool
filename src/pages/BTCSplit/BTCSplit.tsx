import { useState } from 'react';
import { getBTCAccount, fetchUTXOs, splitSelectedUTXOs, UTXO } from '../../utils/bitcoin';
import { NetworkType, networkConfigs } from '../../utils/config';

interface Output {
  address: string;
  value: string; // 用字符串是为了方便输入处理
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
      setChangeAddress(address); // 默认找零地址设为当前地址
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
    <div className="btc-container">
      <h2>比特币 UTXO 拆分工具</h2>

      <div className="input-group">
        <label>选择网络</label>
        <select value={networkType} onChange={e => setNetworkType(e.target.value as NetworkType)}>
          {Object.keys(networkConfigs).map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        <select value={addressType} onChange={e => setAddressType(e.target.value as 'p2tr' | 'p2wpkh')}>
          <option value="p2tr">Taproot (bc1p)</option>
          <option value="p2wpkh">SegWit (bc1q)</option>
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
          <h4>选择要使用的 UTXO</h4>
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
          step="0.01"
          value={satsPerVbyte}
          onChange={e => setSatsPerVbyte(e.target.value)}
        />
      </div>

      <div className="output-list">
        <label>输出地址和金额</label>
        {outputs.map((output, index) => (
          <div key={index} className="output-row">
            <input
              placeholder="接收地址"
              value={output.address}
              onChange={e => updateOutput(index, 'address', e.target.value)}
            />
            <input
              type="number"
              placeholder="金额 (sats)"
              value={output.value}
              onChange={e => updateOutput(index, 'value', e.target.value)}
            />
            <button onClick={() => removeOutput(index)}>移除</button>
          </div>
        ))}
        <button onClick={addOutput}>添加输出</button>
      </div>

      <div className="input-group">
        <label>找零地址（默认当前地址）</label>
        <input value={changeAddress} onChange={e => setChangeAddress(e.target.value)} />
      </div>

      <button disabled={loading || selectedIndexes.length < 1 || outputs.length === 0} onClick={handleSplit}>
        {loading ? '拆分中...' : '开始拆分'}
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
