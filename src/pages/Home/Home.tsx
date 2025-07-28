import './Home.css'
import { Navbar } from '../../components/Navbar/Navbar';
import { useState } from 'react';
import { ethers } from 'ethers';
import { transfer } from '../../utils';

interface ChainConfig {
  rpc: string;
  chainId: number;
}

const PRESET_CHAINS: Record<string, ChainConfig> = {
  eth: {
    rpc: "https://mainnet.infura.io/v3/YOUR_PROJECT_ID",
    chainId: 1
  },
  bsc: {
    rpc: "https://bsc-dataseed.binance.org/",
    chainId: 56
  },
  base: {
    rpc: "https://mainnet.base.org",
    chainId: 8453
  }
};

interface TransferTask {
  status: 'pending' | 'processing' | 'success' | 'failed';
  hash?: string;
  error?: string;
}

export default function Home() {
  const [hexData, setHexData] = useState('');
  const [amount, setAmount] = useState('');
  const [addressList, setAddressList] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [multiPrivateKeys, setMultiPrivateKeys] = useState('');
  const [targetAddress, setTargetAddress] = useState('');
  const [selectedChain, setSelectedChain] = useState<'eth' | 'bsc' | 'base' | 'custom'>('eth');
  const [chainConfig, setChainConfig] = useState<ChainConfig>(PRESET_CHAINS.eth);
  const [customRpc, setCustomRpc] = useState('');
  const [customChainId, setCustomChainId] = useState('');
  const [tasks, setTasks] = useState<TransferTask[]>([]);
  const [mode, setMode] = useState<'fromOneToMany' | 'fromManyToOne'>('fromOneToMany');

  const handleChainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as typeof selectedChain;
    setSelectedChain(value);
    
    if (value !== 'custom') {
      setChainConfig(PRESET_CHAINS[value]);
    } else {
      setChainConfig({
        rpc: customRpc,
        chainId: Number(customChainId) || 0
      });
    }
  };

  const updateCustomConfig = () => {
    setChainConfig({
      rpc: customRpc,
      chainId: Number(customChainId) || 0
    });
  };

  const validateInputs = () => {
    if (mode === 'fromOneToMany') {
      if (!privateKey.match(/^0x[a-fA-F0-9]{64}$/)) {
        throw new Error('Invalid private key format');
      }
    } else {
      const keys = multiPrivateKeys.split('\n')
        .map(k => k.trim())
        .filter(k => /^0x[a-fA-F0-9]{64}$/.test(k));
      if (keys.length === 0) {
        throw new Error('No valid private keys found');
      }
      if (!ethers.isAddress(targetAddress)) {
        throw new Error('Invalid target address');
      }
    }

    if (hexData && !ethers.isHexString(hexData)) {
      throw new Error('Hex data must start with 0x');
    }

    if (isNaN(Number(amount)) || Number(amount) < 0) {
      throw new Error('Invalid amount');
    }

    if (chainConfig.rpc === '' || chainConfig.chainId <= 0) {
      throw new Error('Invalid chain configuration');
    }
  };

  const handleBatchTransfer = async () => {
    try {
      validateInputs();
      setTasks([]);

      const provider = new ethers.JsonRpcProvider(chainConfig.rpc);

      if (mode === 'fromOneToMany') {
        const addresses = addressList.split('\n')
          .map(a => a.trim())
          .filter(a => ethers.isAddress(a));

        if (addresses.length === 0) throw new Error('No valid addresses');

        const wallet = new ethers.Wallet(privateKey, provider);
        setTasks(addresses.map(() => ({ status: 'pending' })));

        await Promise.all(addresses.map(async (to, index) => {
          try {
            setTasks(prev => {
              const copy = [...prev];
              copy[index] = { status: 'processing' };
              return copy;
            });

            const tx = await transfer({ wallet, toAddress: to, amountInEther: amount, hexData });
            setTasks(prev => {
              const copy = [...prev];
              copy[index] = { status: 'success', hash: tx.hash };
              return copy;
            });
          } catch (err) {
            setTasks(prev => {
              const copy = [...prev];
              copy[index] = {
                status: 'failed',
                error: err instanceof Error ? err.message : 'Unknown error'
              };
              return copy;
            });
          }
        }));

      } else {
        const keys = multiPrivateKeys.split('\n')
          .map(k => k.trim())
          .filter(k => /^0x[a-fA-F0-9]{64}$/.test(k));

        setTasks(keys.map(() => ({ status: 'pending' })));

        await Promise.all(keys.map(async (key, index) => {
          const wallet = new ethers.Wallet(key, provider);
          try {
            setTasks(prev => {
              const copy = [...prev];
              copy[index] = { status: 'processing' };
              return copy;
            });

            const tx = await transfer({ wallet, toAddress: targetAddress, amountInEther: amount, hexData });
            setTasks(prev => {
              const copy = [...prev];
              copy[index] = { status: 'success', hash: tx.hash };
              return copy;
            });
          } catch (err) {
            setTasks(prev => {
              const copy = [...prev];
              copy[index] = {
                status: 'failed',
                error: err instanceof Error ? err.message : 'Unknown error'
              };
              return copy;
            });
          }
        }));
      }

    } catch (error) {
      alert(error instanceof Error ? error.message : 'Transfer failed');
    }
  };

  return (
    <div className="container">
      <div className='navigation'>
        <Navbar />
      </div>

      <div className='main'>
        <h1 className='title'>批量调用合约</h1>

        <div className='config-section'>
          <div className='chain-config'>
            <label>区块链网络:</label>
            <select 
              value={selectedChain}
              onChange={handleChainChange}
              className="chain-select"
            >
              <option value="eth">Ethereum</option>
              <option value="bsc">BNB Chain</option>
              <option value="base">Base</option>
              <option value="custom">自定义网络</option>
            </select>

            {selectedChain === 'custom' && (
              <div className="custom-config">
                <input
                  type="text"
                  placeholder="RPC URL"
                  value={customRpc}
                  onChange={(e) => setCustomRpc(e.target.value)}
                  onBlur={updateCustomConfig}
                />
                <input
                  type="number"
                  placeholder="Chain ID"
                  value={customChainId}
                  onChange={(e) => setCustomChainId(e.target.value)}
                  onBlur={updateCustomConfig}
                />
              </div>
            )}

            <div className='input-group'>
              <label>转账模式:</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="chain-select">
                <option value="fromOneToMany">一个私钥转多个地址</option>
                <option value="fromManyToOne">多个私钥转一个地址</option>
              </select>
            </div>

            {mode === 'fromOneToMany' ? (
              <>
                <div className='input-group'>
                  <label>发送方私钥:</label>
                  <input
                    type="password"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    placeholder="0x开头64位"
                  />
                </div>

                <div className='input-group'>
                  <label>接收地址列表 (每行一个):</label>
                  <textarea
                    value={addressList}
                    onChange={(e) => setAddressList(e.target.value)}
                    rows={6}
                    placeholder="0x1234...\n0xabcd..."
                  />
                </div>
              </>
            ) : (
              <>
                <div className='input-group'>
                  <label>多个发送方私钥 (每行一个):</label>
                  <textarea
                    value={multiPrivateKeys}
                    onChange={(e) => setMultiPrivateKeys(e.target.value)}
                    rows={6}
                    placeholder="0xabc...\n0xdef..."
                  />
                </div>

                <div className='input-group'>
                  <label>接收地址:</label>
                  <input
                    value={targetAddress}
                    onChange={(e) => setTargetAddress(e.target.value)}
                    placeholder="0x..."
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className='batch-section'>
          <div className='params-group'>
            <div className='input-group'>
              <label>转账金额 (ETH):</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.001"
              />
            </div>

            <div className='input-group'>
              <label>调用数据 (Hex):</label>
              <input
                value={hexData}
                onChange={(e) => setHexData(e.target.value)}
                placeholder="0x..."
              />
            </div>
          </div>

          <button 
            className='submit-btn'
            onClick={handleBatchTransfer}
            disabled={tasks.some(t => t.status === 'processing')}
          >
            {tasks.some(t => t.status === 'processing') 
              ? `处理中 (${tasks.filter(t => t.status === 'processing').length}/${tasks.length})`
              : '开始批量转账'}
          </button>
        </div>

        <div className='task-list'>
          {tasks.map((task, index) => (
            <div key={index} className={`task-item ${task.status}`}>
              <span className='task-id'>任务 #{index + 1}</span>
              <div className='task-status'>
                {task.status === 'success' && task.hash && (
                  <a 
                    href={`https://etherscan.io/tx/${task.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    查看交易
                  </a>
                )}
                {task.status === 'failed' && (
                  <span className='error-msg'>{task.error}</span>
                )}
                {task.status === 'processing' && (
                  <span className='processing'>等待确认...</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
