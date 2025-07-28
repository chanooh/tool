import { ethers, Wallet } from "ethers";

interface TransferParams {
  wallet: Wallet;                  // 已连接provider的钱包实例
  toAddress: string;               // 接收地址
  amountInEther: number | string;   // 转账金额(支持字符串或数字)
  hexData?: string;                 // 可选十六进制数据
}

async function transfer(params: TransferParams): Promise<ethers.TransactionResponse> {
  const { wallet, toAddress, amountInEther, hexData = "0x" } = params;

  // 类型安全校验
  if (!ethers.isAddress(toAddress)) {
    throw new Error("Invalid recipient address");
  }
  
  if (!ethers.isHexString(hexData)) {
    throw new Error("Hex data must be a valid 0x-prefixed string");
  }

  // 单位转换（支持字符串和数字输入）
  const value = ethers.parseEther(
    typeof amountInEther === "string" 
      ? amountInEther 
      : amountInEther.toString()
  );

  // 构造交易对象
  const tx = {
    to: toAddress,
    value,
    data: hexData,
    // 可在此扩展 gasLimit/gasPrice 等参数
  };

  try {
    // 发送交易（自动处理nonce和签名）
    const transaction = await wallet.sendTransaction(tx);
    console.log(`Transaction broadcasted: ${transaction.hash}`);
    return transaction;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Transfer failed: ${error.message}`);
    }
    throw new Error("Transfer failed with unknown error");
  }
}

export { transfer };
export type { TransferParams };
