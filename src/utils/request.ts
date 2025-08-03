import axios from 'axios';

export class Request {
  constructor(
    private unisatWalletUri: string,
    private mempoolUri: string,
  ) {}

  // async getUTXO(address: string) {
  //   const url = `${this.unisatWalletUri}/v5/address/btc-utxo?address=${address}`;
  //   const res = await axios.get(url);
  //   if (res.data?.code === 0) {
  //     return res.data.data;
  //   }
  //   return [];
  // }

  async getUTXO(address: string) {
    const normalUrl = `${this.unisatWalletUri}/v1/indexer/address/${address}/utxo-data?cursor=0&size=500`;
    const inscriptionUrl = `${this.unisatWalletUri}/v1/indexer/address/${address}/inscription-utxo-data?cursor=0&size=500`;
  
    try {
      const [normalRes, insRes] = await Promise.all([
        axios.get(normalUrl),
        axios.get(inscriptionUrl),
      ]);
  
      const normalUTXO = normalRes.data?.data?.utxo ?? [];
      const inscriptionUTXO = insRes.data?.data?.utxo ?? [];
  
      // 合并并去重（根据 txid+vout）
      const allUTXO = [...normalUTXO, ...inscriptionUTXO];
      const uniqueUTXO = Object.values(
        allUTXO.reduce((acc: any, utxo: any) => {
          const key = `${utxo.txid}:${utxo.vout}`;
          acc[key] = utxo;
          return acc;
        }, {})
      );
  
      return uniqueUTXO;
    } catch (error) {
      console.error('❌ 获取 UTXO 失败:', (error as Error).message);
      return [];
    }
  }
  

  async broadcastTx(rawtx: string) {
    const url = `${this.mempoolUri}/api/tx`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: rawtx,
        headers: {
          'Content-Type': 'text/plain', // Mempool.space expects raw transaction hex as plain text
        },
      });
  
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`广播失败: ${errorText || res.statusText}`);
      }
  
      const txid = await res.text(); // Mempool.space returns the transaction ID as plain text
      console.log('✅ 交易广播成功，txid:', txid);
      return txid;
    } catch (error) {
      console.error('❌ 交易广播失败:', error);
      if (error instanceof Error) {
        throw new Error(`广播失败: ${error.message}`);
      }
      throw new Error('广播失败: 未知错误');
    }
  }
}
