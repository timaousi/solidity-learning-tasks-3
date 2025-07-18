// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol"; // 引入 IERC721 接口，因为 createAuction 中使用了 safeTransferFrom
import "./Auction.sol"; // 导入 Auction 合约定义

contract AuctionFactory is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address public auctionImplementation; // 拍卖合约的实现地址
    mapping(uint256 => address) public auctions; // 存储所有已部署的拍卖合约地址 (按索引)
    uint256 public auctionCount; // 已部署的拍卖合约数量

    event AuctionDeployed(address auction, address nftContract, uint256 tokenId); // 拍卖部署事件

    /**
     * @notice 工厂合约初始化函数
     * @param _auctionImplementation 拍卖合约的实现地址
     */
    function initialize(address _auctionImplementation) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        auctionImplementation = _auctionImplementation;
    }

    /**
     * @notice UUPS 升级授权函数
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @notice 创建新拍卖
     * @param nftContract NFT 合约地址
     * @param tokenId 待拍卖的 NFT ID
     * @param duration 拍卖持续时间（秒）
     * @param erc20Token 可接受的 ERC20 代币地址
     * @param priceFeed Chainlink 价格预言机地址
     * @param feePercentage 拍卖手续费百分比 (万分之几，例如 100 代表 1%)
     * @return 返回新创建的拍卖合约地址
     */
    function createAuction(
        address nftContract,
        uint256 tokenId,
        uint256 duration,
        address erc20Token,
        address priceFeed,
        uint256 feePercentage
    ) public returns (address) {
        require(nftContract != address(0), unicode"无效的 NFT 合约地址");
        require(erc20Token != address(0), unicode"无效的 ERC20 代币地址");
        require(priceFeed != address(0), unicode"无效的价格预言机地址");
        require(duration > 0, unicode"无效的拍卖持续时间");
        require(feePercentage <= 1000, unicode"无效的手续费百分比 (最大 10%)"); // 1000 = 10%

        // 使用 Clones 库创建拍卖合约的克隆（省油的代理）
        address auction = Clones.clone(auctionImplementation);
        
        // **修复点：将 address 类型显式转换为 payable address**
        Auction(payable(auction)).initialize(nftContract, tokenId, msg.sender, duration, erc20Token, priceFeed, feePercentage);
        
        // 记录新创建的拍卖合约地址
        auctions[auctionCount] = auction;
        auctionCount += 1;
        
        // 将 NFT 从卖家转移到新创建的拍卖合约中
        IERC721(nftContract).safeTransferFrom(msg.sender, auction, tokenId);
        
        // 发出拍卖部署事件
        emit AuctionDeployed(auction, nftContract, tokenId);
        
        return auction;
    }

    /**
     * @notice 获取所有拍卖地址
     * @return 返回一个包含所有已部署拍卖合约地址的数组
     */
    function getAuctions() public view returns (address[] memory) {
        address[] memory result = new address[](auctionCount);
        for (uint256 i = 0; i < auctionCount; i++) {
            result[i] = auctions[i];
        }
        return result;
    }
}