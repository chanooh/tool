import { useState } from 'react';
import { ethers } from 'ethers';
import { transfer, approveToken } from '../../utils';
import styles from './Home.module.css';

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
    rpc: "https://bsc-pokt.nodies.app",
    chainId: 56
  },
  base: {
    rpc: "https://mainnet.base.org",
    chainId: 8453
  }
};

// Token contract addresses for different chains
const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  eth: {
    USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  },
  bsc: {
    USDT: '0x55d398326f99059ff775485246999027b3197955',
    USDC: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'
  },
  base: {
    USDT: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2',
    USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
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
  const [tokenType, setTokenType] = useState<'USDT' | 'USDC' | 'custom'>('USDT');
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [spenderAddress, setSpenderAddress] = useState('');

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

  const validateApprovalInputs = () => {
    if (!privateKey.match(/^0x[a-fA-F0-9]{64}$/)) {
      throw new Error('Invalid private key format');
    }
    if (!ethers.isAddress(spenderAddress)) {
      throw new Error('Invalid spender address');
    }
    if (tokenType === 'custom' && !ethers.isAddress(customTokenAddress)) {
      throw new Error('Invalid custom token address');
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

  const handleTokenApproval = async () => {
    try {
      validateApprovalInputs();
      setTasks([]);

      const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
      const wallet = new ethers.Wallet(privateKey, provider);

      const tokenAddress = tokenType === 'custom' 
        ? customTokenAddress 
        : TOKEN_ADDRESSES[selectedChain]?.[tokenType];

      if (!tokenAddress) {
        throw new Error(`Token ${tokenType} not supported on ${selectedChain}`);
      }

      setTasks([{ status: 'pending' }]);

      try {
        setTasks([{ status: 'processing' }]);
        const tx = await approveToken({
          wallet,
          tokenAddress,
          spenderAddress
        });
        setTasks([{ status: 'success', hash: tx.hash }]);
      } catch (err) {
        setTasks([{
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error'
        }]);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Approval failed');
    }
  };

  const getExplorerUrl = (hash: string) => {
    switch (selectedChain) {
      case 'eth':
        return `https://etherscan.io/tx/${hash}`;
      case 'bsc':
        return `https://bscscan.com/tx/${hash}`;
      case 'base':
        return `https://basescan.org/tx/${hash}`;
      default:
        return '#';
    }
  };

  return (
    <div className={styles['main-container']}>

      <div className={styles['content-wrapper']}>
        <h1 className={styles.title}>批量调用合约</h1>
        <p className={styles.subtitle}>执行批量转账或代币授权</p>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>网络配置</h2>
          <div className={styles.formGroup}>
            <label className={styles.label}>区块链网络:</label>
            <select 
              value={selectedChain}
              onChange={handleChainChange}
              className={styles.input}
            >
              <option value="eth">Ethereum</option>
              <option value="bsc">BNB Chain</option>
              <option value="base">Base</option>
              <option value="custom">自定义网络</option>
            </select>
          </div>

          {selectedChain === 'custom' && (
            <div className={styles.customConfig}>
              <input
                className={styles.input}
                type="text"
                placeholder="RPC URL"
                value={customRpc}
                onChange={(e) => setCustomRpc(e.target.value)}
                onBlur={updateCustomConfig}
              />
              <input
                className={styles.input}
                type="number"
                placeholder="Chain ID"
                value={customChainId}
                onChange={(e) => setCustomChainId(e.target.value)}
                onBlur={updateCustomConfig}
              />
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>批量转账</h2>
          <div className={styles.formGroup}>
            <label className={styles.label}>转账模式:</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as any)} className={styles.input}>
              <option value="fromOneToMany">一个私钥转多个地址</option>
              <option value="fromManyToOne">多个私钥转一个地址</option>
            </select>
          </div>

          {mode === 'fromOneToMany' ? (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>发送方私钥:</label>
                <input
                  className={styles.input}
                  type="password"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="0x开头64位"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>接收地址列表 (每行一个):</label>
                <textarea
                  className={styles.textarea}
                  value={addressList}
                  onChange={(e) => setAddressList(e.target.value)}
                  rows={6}
                  placeholder="0x1234...\n0xabcd..."
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>多个发送方私钥 (每行一个):</label>
                <textarea
                  className={styles.textarea}
                  value={multiPrivateKeys}
                  onChange={(e) => setMultiPrivateKeys(e.target.value)}
                  rows={6}
                  placeholder="0xabc...\n0xdef..."
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>接收地址:</label>
                <input
                  className={styles.input}
                  value={targetAddress}
                  onChange={(e) => setTargetAddress(e.target.value)}
                  placeholder="0x..."
                />
              </div>
            </>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>转账金额 (ETH):</label>
            <input
              className={styles.input}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.001"
              placeholder='0.01'
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>调用数据 (Hex):</label>
            <input
              className={styles.input}
              value={hexData}
              onChange={(e) => setHexData(e.target.value)}
              placeholder="0x..."
            />
          </div>
          
          <button 
            className={styles.submitBtn}
            onClick={handleBatchTransfer}
            disabled={tasks.some(t => t.status === 'processing') || (mode === 'fromOneToMany' && (!privateKey || !addressList || !amount)) || (mode === 'fromManyToOne' && (!multiPrivateKeys || !targetAddress || !amount))}
          >
            {tasks.some(t => t.status === 'processing') 
              ? `处理中 (${tasks.filter(t => t.status === 'processing').length}/${tasks.length})`
              : '开始批量转账'}
          </button>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>代币无限授权</h2>
          <div className={styles.formGroup}>
            <label className={styles.label}>发送方私钥:</label>
            <input
              className={styles.input}
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="0x开头64位"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>代币类型:</label>
            <select
              value={tokenType}
              onChange={(e) => setTokenType(e.target.value as any)}
              className={styles.input}
            >
              <option value="USDT">USDT</option>
              <option value="USDC">USDC</option>
              <option value="custom">自定义代币</option>
            </select>
          </div>

          {tokenType === 'custom' && (
            <div className={styles.formGroup}>
              <label className={styles.label}>自定义代币地址:</label>
              <input
                className={styles.input}
                value={customTokenAddress}
                onChange={(e) => setCustomTokenAddress(e.target.value)}
                placeholder="0x..."
              />
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>授权目标合约地址:</label>
            <input
              className={styles.input}
              value={spenderAddress}
              onChange={(e) => setSpenderAddress(e.target.value)}
              placeholder="0x..."
            />
          </div>

          <button
            className={styles.submitBtn}
            onClick={handleTokenApproval}
            disabled={tasks.some(t => t.status === 'processing') || !privateKey || !spenderAddress || (tokenType === 'custom' && !customTokenAddress)}
          >
            {tasks.some(t => t.status === 'processing')
              ? '处理中...'
              : '授权代币'}
          </button>
        </div>

        <div className={styles.taskList}>
          {tasks.length > 0 && <h2 className={styles.sectionTitle}>任务状态</h2>}
          {tasks.map((task, index) => (
            <div key={index} className={`${styles.taskItem} ${styles[task.status]}`}>
              <span className={styles.taskId}>任务 #{index + 1}</span>
              <div className={styles.taskStatus}>
                {task.status === 'success' && task.hash && (
                  <a 
                    href={getExplorerUrl(task.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.taskLink}
                  >
                    查看交易 ↗️
                  </a>
                )}
                {task.status === 'failed' && (
                  <span className={styles.errorMsg}>❌ {task.error}</span>
                )}
                {task.status === 'processing' && (
                  <span className={styles.processing}>⏳ 等待确认...</span>
                )}
                {task.status === 'pending' && (
                  <span className={styles.pending}>⌛ 待处理...</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}