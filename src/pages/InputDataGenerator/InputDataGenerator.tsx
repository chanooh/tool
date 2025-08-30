import { useState } from 'react';
import { encodeFunctionData, EncodeFunctionDataParams } from '../../utils';
import styles from './InputDataGenerator.module.css';

interface Parameter {
  type: string;
  value: string;
  unit?: string;
}

export default function InputDataGenerator() {
  const [abiInput, setAbiInput] = useState('["function buy(uint256 _id, address _user, uint256 _amount, uint256 _tierIndex)"]');
  const [functionName, setFunctionName] = useState('buy');
  const [parameters, setParameters] = useState<Parameter[]>([
    { type: 'uint256', value: '300', unit: 'ether' },
    { type: 'address', value: '0x1234567890123456789012345678901234567890' },
    { type: 'uint256', value: '0', unit: 'wei' },
    { type: 'uint256', value: new Date().toISOString().slice(0, 19).replace('T', ' '), unit: 'datetime' }
  ]);
  
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
    <div className={styles.container}>

      <div className={styles.main}>
        <h1 className={styles.title}>生成 Input Data</h1>
        <p className={styles.subtitle}>根据函数ABI和参数，生成合约调用的十六进制数据</p>

        <div className={styles.section}>
          <div className={styles.formGroup}>
            <label className={styles.label}>合约 ABI (JSON 格式):</label>
            <textarea
              className={styles.textarea}
              value={abiInput}
              onChange={(e) => setAbiInput(e.target.value)}
              rows={4}
              placeholder='["function buy(uint256 _itemId, uint256 _quantity, address _paymentToken, uint256 _paymentAmount)"]'
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>函数名称:</label>
            <input
              className={styles.input}
              value={functionName}
              onChange={(e) => setFunctionName(e.target.value)}
              placeholder="buy"
            />
          </div>
        </div>
        
        <div className={`${styles.section} ${styles.parameterList}`}>
          <h2 className={styles.sectionTitle}>函数参数</h2>
          {parameters.map((param, index) => (
            <div key={index} className={styles.parameterRow}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>类型:</label>
                <select
                  className={styles.input}
                  value={param.type}
                  onChange={(e) => updateParameter(index, 'type', e.target.value)}
                >
                  <option value="uint256">uint256</option>
                  <option value="int256">int256</option>
                  <option value="address">address</option>
                  <option value="string">string</option>
                  <option value="bool">bool</option>
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>值:</label>
                <input
                  className={styles.input}
                  value={param.value}
                  onChange={(e) => updateParameter(index, 'value', e.target.value)}
                  placeholder={
                    param.type === 'address' ? '0x...' :
                    param.type === 'bool' ? 'true/false' :
                    '参数值'
                  }
                />
              </div>

              {['uint256', 'int256'].includes(param.type) && (
                <div className={styles.inputGroup}>
                  <label className={styles.label}>单位:</label>
                  <select
                    className={styles.input}
                    value={param.unit || 'wei'}
                    onChange={(e) => updateParameter(index, 'unit', e.target.value)}
                  >
                    <option value="wei">Wei</option>
                    <option value="gwei">Gwei</option>
                    <option value="ether">Ether</option>
                    <option value="datetime">Datetime</option>
                  </select>
                </div>
              )}
              
              <button
                className={styles.removeButton}
                onClick={() => removeParameter(index)}
              >
                删除
              </button>
            </div>
          ))}

          <button
            className={styles.addButton}
            onClick={addParameter}
          >
            添加参数
          </button>
        </div>

        <button
          className={styles.submitBtn}
          onClick={handleGenerateInputData}
        >
          生成 Input Data
        </button>

        {generatedInputData && (
          <div className={`${styles.section} ${styles.outputSection}`}>
            <h2 className={styles.sectionTitle}>生成的 Input Data</h2>
            <textarea
              className={styles.outputData}
              value={generatedInputData}
              readOnly
              rows={3}
            />
          </div>
        )}

        {inputDataError && (
          <p className={styles.errorMsg}>❌ {inputDataError}</p>
        )}
      </div>
    </div>
  );
}