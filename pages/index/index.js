// 彩票模式配置
const lotteryModes = {
  dlt: {
    name: '大乐透',
    frontRange: 35,
    frontCount: 5,
    backRange: 12,
    backCount: 2,
    frontHighFreqRequired: 3,
    backHighFreqRequired: 1,
    coldThreshold: 0.08,
    coldPeriods: 100,
    officialUrl: 'https://www.lottery.gov.cn/kj/kjlb.html?dlt',
    exampleFormat: '例如：03 12 18 25 33 05 11 或 03,12,18,25,33,05,11'
  },
  ssq: {
    name: '双色球',
    frontRange: 33,
    frontCount: 6,
    backRange: 16,
    backCount: 1,
    frontHighFreqRequired: 4,
    backHighFreqRequired: 0,
    coldThreshold: 0.08,
    coldPeriods: 50,
    officialUrl: 'https://m.17500.cn/kj-m/list-ssq.html',
    exampleFormat: '例如：01 11 15 25 26 33 16 或 01,11,15,25,26,33,16'
  }
};

Page({
  data: {
    currentMode: 'dlt', // 当前模式：dlt(大乐透) 或 ssq(双色球)
    historyData: '', // 历史数据输入
    dataError: '', // 数据错误信息
    dataAnalyzed: false, // 数据是否已分析
    frontFrequency: {}, // 前区号码频率
    backFrequency: {}, // 后区号码频率
    frontStatsArray: [], // 前区统计数据数组
    backStatsArray: [], // 后区统计数据数组
    generationHistory: [], // 生成历史
    canGenerateFinal: false, // 是否可以生成最终号码
    finalNumbersGenerated: false, // 是否已生成最终号码
    finalNumbers: null, // 最终号码
    finalLogicFront: '', // 最终前区逻辑
    finalLogicBack: '', // 最终后区逻辑
    finalLogicExplanation: '' // 最终逻辑说明
  },

  onLoad() {
    this.initFrequencyData();
  },

  // 初始化频率数据
  initFrequencyData() {
    const frontFrequency = {};
    const backFrequency = {};
    const mode = lotteryModes[this.data.currentMode];
    
    // 初始化前区号码频率
    for (let i = 1; i <= mode.frontRange; i++) {
      frontFrequency[i] = 0;
    }
    
    // 初始化后区号码频率
    for (let i = 1; i <= mode.backRange; i++) {
      backFrequency[i] = 0;
    }
    
    this.setData({
      frontFrequency,
      backFrequency
    });
  },

  // 切换彩票模式
  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (this.data.currentMode === mode) return;
    
    // 重置数据
    this.resetGenerationHistory();
    
    this.setData({
      currentMode: mode,
      dataAnalyzed: false,
      historyData: ''
    });
    
    this.initFrequencyData();
  },

  // 历史数据输入变化
  onHistoryDataInput(e) {
    this.setData({
      historyData: e.detail.value
    });
  },

  // 清空数据
  clearData() {
    this.setData({
      historyData: '',
      dataError: '',
      dataAnalyzed: false,
      generationHistory: [],
      canGenerateFinal: false,
      finalNumbersGenerated: false
    });
    this.initFrequencyData();
  },

  // 打开官方数据页面
  openOfficialData() {
    const url = lotteryModes[this.data.currentMode].officialUrl;
    wx.showModal({
      title: '提示',
      content: '将跳转到外部浏览器查看官方数据',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({
            data: url,
            success: () => {
              wx.showToast({
                title: '链接已复制，请在浏览器中打开',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },

  // 分析历史数据
  analyzeData() {
    const data = this.data.historyData.trim();
    if (!data) {
      this.setData({ dataError: "请输入历史开奖数据" });
      return;
    }
    
    // 初始化频率数据
    this.initFrequencyData();
    
    const mode = lotteryModes[this.data.currentMode];
    const totalNumbers = mode.frontCount + mode.backCount;
    
    // 分割多行数据
    const lines = data.split('\n');
    let validLines = 0;
    
    const frontFrequency = {...this.data.frontFrequency};
    const backFrequency = {...this.data.backFrequency};
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // 支持空格或逗号分隔
      let numbers;
      if (line.includes(',')) {
        numbers = line.split(',').map(n => parseInt(n.trim()));
      } else {
        numbers = line.split(/\s+/).map(n => parseInt(n.trim()));
      }
      
      // 验证数据格式
      if (numbers.length !== totalNumbers || numbers.some(isNaN)) {
        continue;
      }
      
      // 验证数字范围
      const frontNumbers = numbers.slice(0, mode.frontCount);
      const backNumbers = numbers.slice(mode.frontCount, totalNumbers);
      
      const validFront = frontNumbers.every(n => n >= 1 && n <= mode.frontRange);
      const validBack = backNumbers.every(n => n >= 1 && n <= mode.backRange);
      
      if (!validFront || !validBack) {
        continue;
      }
      
      // 统计频率
      frontNumbers.forEach(n => frontFrequency[n]++);
      backNumbers.forEach(n => backFrequency[n]++);
      
      validLines++;
    }
    
    if (validLines === 0) {
      this.setData({
        dataError: `没有有效的数据行，请检查格式是否符合${mode.name}规则`
      });
      return;
    }
    
    // 计算统计数据数组
    const frontStatsArray = this.calculateStatsArray(frontFrequency);
    const backStatsArray = this.calculateStatsArray(backFrequency);
    
    this.setData({
      frontFrequency,
      backFrequency,
      frontStatsArray,
      backStatsArray,
      dataError: '',
      dataAnalyzed: true,
      generationHistory: [],
      canGenerateFinal: false,
      finalNumbersGenerated: false
    });
  },

  // 计算统计数据数组
  calculateStatsArray(frequency) {
    const maxFreq = Math.max(...Object.values(frequency));
    
    return Object.entries(frequency).map(([number, freq]) => {
      return {
        number: parseInt(number),
        frequency: freq,
        percentage: maxFreq > 0 ? (freq / maxFreq) * 100 : 0
      };
    }).sort((a, b) => a.number - b.number);
  },

  // 根据频率计算权重
  calculateWeights(frequency) {
    const weights = {};
    const values = Object.values(frequency);
    const maxFreq = Math.max(...values);
    const minFreq = Math.min(...values);
    const range = maxFreq - minFreq;
    
    // 权重计算公式：基础权重 + 频率调整
    for (const [num, freq] of Object.entries(frequency)) {
      // 基础权重为0.7，频率调整为0.3
      const baseWeight = 0.7;
      const freqWeight = range > 0 ? 0.3 * ((freq - minFreq) / range) : 0;
      weights[num] = baseWeight + freqWeight;
    }
    
    return weights;
  },

  // 根据权重随机选择数字
  weightedRandom(weights, count, range) {
    const numbers = [];
    const availableNumbers = [...Array(range).keys()].map(i => i + 1);
    
    while (numbers.length < count && availableNumbers.length > 0) {
      // 计算总权重
      let totalWeight = 0;
      for (const num of availableNumbers) {
        totalWeight += weights[num];
      }
      
      // 随机选择
      let random = Math.random() * totalWeight;
      let selectedIndex = -1;
      
      for (let i = 0; i < availableNumbers.length; i++) {
        const num = availableNumbers[i];
        random -= weights[num];
        
        if (random <= 0) {
          selectedIndex = i;
          break;
        }
      }
      
      // 如果没有选中，选择最后一个
      if (selectedIndex === -1) {
        selectedIndex = availableNumbers.length - 1;
      }
      
      // 添加选中的数字并从可用列表中移除
      numbers.push(availableNumbers[selectedIndex]);
      availableNumbers.splice(selectedIndex, 1);
    }
    
    return numbers.sort((a, b) => a - b);
  },

  // 生成号码
  generateNumbers() {
    if (!this.data.dataAnalyzed) {
      this.setData({ dataError: "请先分析历史数据" });
      return;
    }
    
    if (this.data.finalNumbersGenerated) {
      this.setData({ dataError: "已生成最终号码，请先重置" });
      return;
    }
    
    const generationHistory = [];
    const mode = lotteryModes[this.data.currentMode];
    
    // 一次性生成5组号码
    for (let i = 0; i < 5; i++) {
      // 计算权重
      const frontWeights = this.calculateWeights(this.data.frontFrequency);
      const backWeights = this.calculateWeights(this.data.backFrequency);
      
      // 生成号码
      const frontNumbers = this.weightedRandom(frontWeights, mode.frontCount, mode.frontRange);
      const backNumbers = this.weightedRandom(backWeights, mode.backCount, mode.backRange);
      
      generationHistory.push({
        front: frontNumbers,
        back: backNumbers
      });
    }
    
    this.setData({
      generationHistory,
      canGenerateFinal: true,
      dataError: ''
    });
  },

  // 重置生成历史
  resetGenerationHistory() {
    this.setData({
      generationHistory: [],
      canGenerateFinal: false,
      finalNumbersGenerated: false,
      finalNumbers: null,
      dataError: ''
    });
  },

  // 获取高频数字（出现次数 >= 2）
  getHighFrequencyNumbers(area) {
    if (this.data.generationHistory.length < 2) return [];
    
    const frequency = {};
    const mode = lotteryModes[this.data.currentMode];
    
    // 初始化频率
    const range = area === 'front' ? mode.frontRange : mode.backRange;
    for (let i = 1; i <= range; i++) {
      frequency[i] = 0;
    }
    
    // 统计频率
    this.data.generationHistory.forEach(numbers => {
      numbers[area].forEach(num => {
        frequency[num] = (frequency[num] || 0) + 1;
      });
    });
    
    // 筛选高频数字
    return Object.entries(frequency)
      .filter(([_, freq]) => freq >= 2)
      .map(([num, _]) => parseInt(num))
      .sort((a, b) => a - b);
  },

  // 检查是否需要包含冷门号码
  checkNeedColdNumbers() {
    const mode = lotteryModes[this.data.currentMode];
    
    // 计算冷门阈值
    const frontThreshold = Object.values(this.data.frontFrequency).reduce((a, b) => a + b, 0) / mode.frontRange * mode.coldThreshold;
    const backThreshold = Object.values(this.data.backFrequency).reduce((a, b) => a + b, 0) / mode.backRange * mode.coldThreshold;
    
    // 找出冷门号码
    const coldFrontNumbers = Object.entries(this.data.frontFrequency)
      .filter(([_, freq]) => freq <= frontThreshold)
      .map(([num, _]) => parseInt(num));
    
    const coldBackNumbers = Object.entries(this.data.backFrequency)
      .filter(([_, freq]) => freq <= backThreshold)
      .map(([num, _]) => parseInt(num));
    
    // 检查5次生成结果中是否包含冷门号码
    let frontHasCold = false;
    let backHasCold = false;
    
    for (const numbers of this.data.generationHistory) {
      for (const num of numbers.front) {
        if (coldFrontNumbers.includes(num)) {
          frontHasCold = true;
          break;
        }
      }
      
      for (const num of numbers.back) {
        if (coldBackNumbers.includes(num)) {
          backHasCold = true;
          break;
        }
      }
    }
    
    return {
      front: !frontHasCold && coldFrontNumbers.length > 0,
      back: !backHasCold && coldBackNumbers.length > 0,
      coldFrontNumbers,
      coldBackNumbers
    };
  },

  // 生成最终号码
  generateFinalNumbers() {
    if (!this.data.canGenerateFinal) {
      this.setData({ dataError: "请先生成号码" });
      return;
    }
    
    if (this.data.finalNumbersGenerated) {
      this.setData({ dataError: "已生成最终号码，请先重置" });
      return;
    }
    
    const mode = lotteryModes[this.data.currentMode];
    
    // 获取高频号码
    const frontHighFreq = this.getHighFrequencyNumbers('front');
    const backHighFreq = this.getHighFrequencyNumbers('back');
    
    // 检查是否需要包含冷门号码
    const coldCheck = this.checkNeedColdNumbers();
    
    // 生成最终号码
    let finalFront = [];
    let finalBack = [];
    let finalLogicFront = '';
    let finalLogicBack = '';
    let finalLogicExplanation = '';
    
    // 前区号码生成逻辑
    if (frontHighFreq.length >= mode.frontHighFreqRequired) {
      // 如果高频号码足够，使用高频号码
      finalFront = [...frontHighFreq];
      finalLogicFront = `使用高频号码：${finalFront.join(', ')}`;
      
      // 如果高频号码不足，随机补充
      if (finalFront.length < mode.frontCount) {
        const frontWeights = this.calculateWeights(this.data.frontFrequency);
        const remainingCount = mode.frontCount - finalFront.length;
        
        // 排除已选号码
        const availableNumbers = [...Array(mode.frontRange).keys()]
          .map(i => i + 1)
          .filter(n => !finalFront.includes(n));
        
        // 随机选择剩余号码
        const remainingNumbers = [];
        while (remainingNumbers.length < remainingCount && availableNumbers.length > 0) {
          const index = Math.floor(Math.random() * availableNumbers.length);
          remainingNumbers.push(availableNumbers[index]);
          availableNumbers.splice(index, 1);
        }
        
        finalFront = [...finalFront, ...remainingNumbers].sort((a, b) => a - b);
        finalLogicFront += `，随机补充：${remainingNumbers.join(', ')}`;
      }
    } else {
      // 如果高频号码不足，随机选择一组
      const randomIndex = Math.floor(Math.random() * this.data.generationHistory.length);
      finalFront = [...this.data.generationHistory[randomIndex].front];
      finalLogicFront = `随机选择第${randomIndex + 1}组号码：${finalFront.join(', ')}`;
    }
    
    // 检查是否需要包含冷门号码
    let coldFront = null;
    if (coldCheck.front && !finalFront.some(n => coldCheck.coldFrontNumbers.includes(n))) {
      // 随机选择一个冷门号码替换
      const coldIndex = Math.floor(Math.random() * coldCheck.coldFrontNumbers.length);
      const replaceIndex = Math.floor(Math.random() * finalFront.length);
      
      coldFront = coldCheck.coldFrontNumbers[coldIndex];
      const replaced = finalFront[replaceIndex];
      
      finalFront[replaceIndex] = coldFront;
      finalFront.sort((a, b) => a - b);
      
      finalLogicFront += `，替换${replaced}为冷门号码${coldFront}`;
    }
    
    // 后区号码生成逻辑
    if (backHighFreq.length >= mode.backHighFreqRequired) {
      // 如果高频号码足够，使用高频号码
      finalBack = [...backHighFreq];
      finalLogicBack = `使用高频号码：${finalBack.join(', ')}`;
      
      // 如果高频号码不足，随机补充
      if (finalBack.length < mode.backCount) {
        const backWeights = this.calculateWeights(this.data.backFrequency);
        const remainingCount = mode.backCount - finalBack.length;
        
        // 排除已选号码
        const availableNumbers = [...Array(mode.backRange).keys()]
          .map(i => i + 1)
          .filter(n => !finalBack.includes(n));
        
        // 随机选择剩余号码
        const remainingNumbers = [];
        while (remainingNumbers.length < remainingCount && availableNumbers.length > 0) {
          const index = Math.floor(Math.random() * availableNumbers.length);
          remainingNumbers.push(availableNumbers[index]);
          availableNumbers.splice(index, 1);
        }
        
        finalBack = [...finalBack, ...remainingNumbers].sort((a, b) => a - b);
        finalLogicBack += `，随机补充：${remainingNumbers.join(', ')}`;
      }
    } else {
      // 如果高频号码不足，随机选择一组
      const randomIndex = Math.floor(Math.random() * this.data.generationHistory.length);
      finalBack = [...this.data.generationHistory[randomIndex].back];
      finalLogicBack = `随机选择第${randomIndex + 1}组号码：${finalBack.join(', ')}`;
    }
    
    // 检查是否需要包含冷门号码
    let coldBack = null;
    if (coldCheck.back && !finalBack.some(n => coldCheck.coldBackNumbers.includes(n))) {
      // 随机选择一个冷门号码替换
      const coldIndex = Math.floor(Math.random() * coldCheck.coldBackNumbers.length);
      const replaceIndex = Math.floor(Math.random() * finalBack.length);
      
      coldBack = coldCheck.coldBackNumbers[coldIndex];
      const replaced = finalBack[replaceIndex];
      
      finalBack[replaceIndex] = coldBack;
      finalBack.sort((a, b) => a - b);
      
      finalLogicBack += `，替换${replaced}为冷门号码${coldBack}`;
    }
    
    // 生成最终逻辑说明
    finalLogicExplanation = `基于${this.data.generationHistory.length}组随机号码和历史数据分析，智能合成最终号码。`;
    
    // 设置最终号码
    this.setData({
      finalNumbers: {
        front: finalFront,
        back: finalBack,
        frontHighFreq: frontHighFreq,
        backHighFreq: backHighFreq,
        coldFront: coldFront,
        coldBack: coldBack
      },
      finalLogicFront,
      finalLogicBack,
      finalLogicExplanation,
      finalNumbersGenerated: true,
      dataError: ''
    });
  }
});
