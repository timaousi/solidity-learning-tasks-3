// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// 导入 OpenZeppelin 的 ERC20 标准合约
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @dev 用于测试目的的简单模拟 ERC20 代币合约。
 * 它继承了 OpenZeppelin 的 ERC20 合约，并添加了一个公共的 `mint` 函数，
 * 以方便为测试账户创建代币。
 */
contract MockERC20 is ERC20 {
    /**
     * @dev 构造函数，用于使用名称和符号初始化 ERC20 代币。
     * @param name_ 代币的名称。
     * @param symbol_ 代币的符号。
     */
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    /**
     * @dev 铸造新代币并将其分配到指定地址。此函数为方便测试而设置为公共。
     * @param to 接收代币的地址。
     * @param amount 铸造的代币数量。
     */
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}