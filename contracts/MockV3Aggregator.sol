// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// 导入 Chainlink 的 AggregatorV3Interface 接口以确保兼容性
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title MockV3Aggregator
 * @dev 一个模拟合约，用于测试目的，模拟 Chainlink 的 AggregatorV3Interface。
 * 它允许设置初始答案并更新它，模拟价格数据流。
 */
contract MockV3Aggregator is AggregatorV3Interface {
    // 存储当前的价格答案 (重命名为 _answer 以避免与返回变量冲突)
    int256 internal _answer;
    // 存储价格数据的小数位数
    uint8 internal decimalsValue;

    /**
     * @dev 构造函数，用于使用小数位数和初始价格初始化模拟聚合器。
     * @param _decimals 价格的小数位数。
     * @param _initialAnswer 要设置的初始价格。
     */
    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimalsValue = _decimals;
        _answer = _initialAnswer; // 使用 _answer
    }

    /**
     * @dev 返回用于表示价格的小数位数。
     */
    function decimals() external view override returns (uint8) {
        return decimalsValue;
    }

    /**
     * @dev 返回价格数据流的描述。
     */
    function description() external pure override returns (string memory) {
        return unicode"模拟 ETH / USD 价格数据流";
    }

    /**
     * @dev 返回聚合器的版本。
     */
    function version() external pure override returns (uint256) {
        return 1;
    }

    /**
     * @dev 返回特定轮次的数据。对于此模拟，它返回当前答案
     * 和模拟的时间戳/轮次ID。
     * @param _roundId 要查询的轮次ID。
     */
    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer, // 此处的 answer 是返回变量
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        roundId = _roundId;
        answer = _answer; // 使用状态变量 _answer
        startedAt = block.timestamp;
        updatedAt = block.timestamp;
        answeredInRound = _roundId;
    }

    /**
     * @dev 返回最新的轮次数据。对于此模拟，它返回当前答案
     * 和模拟的时间戳/轮次ID。
     */
    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer, // 此处的 answer 是返回变量
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        roundId = 1; // 模拟轮次ID
        answer = _answer; // 使用状态变量 _answer
        startedAt = block.timestamp;
        updatedAt = block.timestamp;
        answeredInRound = 1; // 模拟回答轮次
    }

    /**
     * @dev 允许更新模拟价格答案。对于测试不同价格场景非常有用。
     * @param newAnswer 要设置的新价格答案。
     */
    function updateAnswer(int256 newAnswer) public {
        _answer = newAnswer; // 更新状态变量 _answer
    }
}

