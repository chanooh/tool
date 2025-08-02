import './InputDataGenerator.css';
import { Navbar } from '../../components/Navbar/Navbar';
import { useState } from 'react';
import { ethers } from 'ethers';
import { encodeFunctionData, EncodeFunctionDataParams } from '../../utils';

interface Parameter {
  type: string;
  value: string;
  unit?: string;
}

export default function InputDataGenerator() {
  const [abiInput, setAbiInput] = useState('');
  const [functionName, setFunctionName] = useState('');
  const [parameters, setParameters] = useState<Parameter[]>([{ type: 'uint256', value: '', unit: 'wei' }]);
  const [generatedInputData, setGeneratedInputData] = useState('');
  const [inputDataError, setInputDataError] = useState('');

  const addParameter = () => {
    setParameters([...parameters, { type: 'uint256', value: '', unit: 'wei' }]);
  };

  const updateParameter = (index: number, field: keyof Parameter, value: string) => {
    const newParameters = [...parameters];
    newParameters[index] = { ...newParameters[index], [field]: value };
    if (field === 'type' && !['uint256', 'int256'].includes(value)) {
      newParameters[index].unit = undefined;
    } else if (field === 'type' && ['uint256', 'int256'].includes(value)) {
      newParameters[index].unit = newParameters[index].unit || 'wei';
    }
    setParameters(newParameters);
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const handleGenerateInputData = async () => {
    try {
      setInputDataError('');
      setGeneratedInputData('');
      const parsedAbi = JSON.parse(abiInput);
      const params: EncodeFunctionDataParams = {
        abi: parsedAbi,
        functionName,
        parameters: parameters.map(param => ({
          type: param.type,
          value: param.value,
          unit: param.unit
        }))
      };
      const data = await encodeFunctionData(params);
      setGeneratedInputData(data);
    } catch (error) {
      setInputDataError(error instanceof Error ? error.message : 'Failed to generate input data');
    }
  };

  return (
    <div className="container">
      <div className='navigation'>
        <Navbar />
      </div>

      <div className='main'>
        <h1 className='title'>生成 Input Data</h1>

        <div className='batch-section'>
          <div className='params-group'>
            <div className='input-group'>
              <label>合约 ABI (JSON 格式):</label>
              <textarea
                value={abiInput}
                onChange={(e) => setAbiInput(e.target.value)}
                rows={4}
                placeholder='["function buy(uint256 _itemId, uint256 _quantity, address _paymentToken, uint256 _paymentAmount)"]'
              />
            </div>

            <div className='input-group'>
              <label>函数名称:</label>
              <input
                value={functionName}
                onChange={(e) => setFunctionName(e.target.value)}
                placeholder="buy"
              />
            </div>
          </div>

          <h3>参数</h3>
          {parameters.map((param, index) => (
            <div key={index} className='params-group'>
              <div className='input-group'>
                <label>类型:</label>
                <select
                  value={param.type}
                  onChange={(e) => updateParameter(index, 'type', e.target.value)}
                  className="chain-select"
                >
                  <option value="uint256">uint256</option>
                  <option value="int256">int256</option>
                  <option value="address">address</option>
                  <option value="string">string</option>
                  <option value="bool">bool</option>
                </select>
              </div>

              <div className='input-group'>
                <label>值:</label>
                <input
                  value={param.value}
                  onChange={(e) => updateParameter(index, 'value', e.target.value)}
                  placeholder={param.type === 'address' ? '0x...' : param.type === 'bool' ? 'true/false' : '值'}
                />
              </div>

              {['uint256', 'int256'].includes(param.type) && (
                <div className='input-group'>
                  <label>单位:</label>
                  <select
                    value={param.unit || 'wei'}
                    onChange={(e) => updateParameter(index, 'unit', e.target.value)}
                    className="chain-select"
                  >
                    <option value="wei">Wei</option>
                    <option value="gwei">Gwei</option>
                    <option value="ether">Ether</option>
                    <option value="datetime">Datetime (YYYY-MM-DD HH:mm:ss)</option>
                  </select>
                </div>
              )}

              <button
                onClick={() => removeParameter(index)}
                style={{ marginLeft: '10px', padding: '8px', background: '#ff4757', color: 'white', border: 'none', borderRadius: '8px' }}
              >
                删除
              </button>
            </div>
          ))}

          <button
            onClick={addParameter}
            style={{ marginTop: '10px', padding: '8px', background: '#00cc88', color: 'white', border: 'none', borderRadius: '8px' }}
          >
            添加参数
          </button>

          <button
            className='submit-btn'
            onClick={handleGenerateInputData}
            style={{ marginTop: '20px' }}
          >
            生成 Input Data
          </button>

          {generatedInputData && (
            <div className='input-group'>
              <label>生成的 Input Data:</label>
              <textarea
                value={generatedInputData}
                readOnly
                rows={3}
              />
            </div>
          )}

          {inputDataError && (
            <p style={{ color: '#ff4757' }}>{inputDataError}</p>
          )}
        </div>
      </div>
    </div>
  );
}