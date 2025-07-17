require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades"); // 确保添加了这一行

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24", // 或者您合约使用的任何版本
  // 您可以在此处添加其他网络配置等
  networks: {
    hardhat: {
      // Hardhat Network 配置
    }
    // 其他网络，例如：
    // sepolia: {
    //   url: "YOUR_SEPOLIA_RPC_URL",
    //   accounts: ["YOUR_PRIVATE_KEY"]
    // }
  }
};
