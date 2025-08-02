import { ethers, Wallet, Contract } from "ethers";

interface TransferParams {
  wallet: Wallet;
  toAddress: string;
  amountInEther: number | string;
  hexData?: string;
}

interface ApproveTokenParams {
  wallet: Wallet;
  tokenAddress: string;
  spenderAddress: string;
}

interface EncodeFunctionDataParams {
  abi: any[];
  functionName: string;
  parameters: Array<{
    type: string;
    value: string;
    unit?: string;
  }>;
}

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)"
];

async function transfer(params: TransferParams): Promise<ethers.TransactionResponse> {
  const { wallet, toAddress, amountInEther, hexData = "0x" } = params;
  if (!ethers.isAddress(toAddress)) {
    throw new Error("Invalid recipient address");
  }
  if (!ethers.isHexString(hexData)) {
    throw new Error("Hex data must be a valid 0x-prefixed string");
  }
  const value = ethers.parseEther(
    typeof amountInEther === "string" 
      ? amountInEther 
      : amountInEther.toString()
  );
  const tx = {
    to: toAddress,
    value,
    data: hexData,
  };
  try {
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

async function approveToken(params: ApproveTokenParams): Promise<ethers.TransactionResponse> {
  const { wallet, tokenAddress, spenderAddress } = params;
  if (!ethers.isAddress(tokenAddress)) {
    throw new Error("Invalid token address");
  }
  if (!ethers.isAddress(spenderAddress)) {
    throw new Error("Invalid spender address");
  }
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  const maxUint256 = ethers.MaxUint256;
  try {
    const tx = await contract.approve(spenderAddress, maxUint256);
    console.log(`Approval transaction broadcasted: ${tx.hash}`);
    return tx;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Approval failed: ${error.message}`);
    }
    throw new Error("Approval failed with unknown error");
  }
}

function encodeFunctionData(params: EncodeFunctionDataParams): string {
  const { abi, functionName, parameters } = params;
  try {
    const iface = new ethers.Interface(abi);
    const processedParams = parameters.map(param => {
      const { type, value, unit } = param;
      if (type === 'address') {
        if (!ethers.isAddress(value)) {
          throw new Error(`Invalid address: ${value}`);
        }
        return value;
      } else if (type === 'bool') {
        if (value.toLowerCase() !== 'true' && value.toLowerCase() !== 'false') {
          throw new Error(`Invalid boolean value: ${value}`);
        }
        return value.toLowerCase() === 'true';
      } else if (type === 'string') {
        return value;
      } else if (['uint256', 'int256'].includes(type)) {
        if (unit === 'datetime') {
          const timestamp = Date.parse(value) / 1000;
          if (isNaN(timestamp)) {
            throw new Error(`Invalid datetime format: ${value}`);
          }
          return BigInt(timestamp).toString();
        } else if (unit === 'ether') {
          return ethers.parseEther(value).toString();
        } else if (unit === 'gwei') {
          return ethers.parseUnits(value, 'gwei').toString();
        } else {
          return ethers.parseUnits(value || '0', 'wei').toString();
        }
      }
      throw new Error(`Unsupported parameter type: ${type}`);
    });
    return iface.encodeFunctionData(functionName, processedParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Encoding failed: ${error.message}`);
    }
    throw new Error("Encoding failed with unknown error");
  }
}

export { transfer, approveToken, encodeFunctionData };
export type { TransferParams, ApproveTokenParams, EncodeFunctionDataParams };