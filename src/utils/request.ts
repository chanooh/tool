import axios from 'axios';

export class Request {
  constructor(
    private unisatWalletUri: string,
    private mempoolUri: string,
  ) {}

  async getUTXO(address: string) {
    const url = `${this.unisatWalletUri}/v5/address/btc-utxo?address=${address}`;
    const res = await axios.get(url);
    if (res.data?.code === 0) {
      return res.data.data;
    }
    return [];
  }

  async broadcastTx(rawtx: string) {
    const url = `${this.unisatWalletUri}/v5/tx/broadcast`;
    const res = await axios.post(url, { rawtx }, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.data?.code === 0) {
      return res.data.data.txid;
    }
    throw new Error(res.data?.msg || '广播失败');
  }
}
