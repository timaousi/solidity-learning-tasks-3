// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./Auction.sol";

contract AuctionFactory is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address public auctionImplementation;
    mapping(uint256 => address) public auctions;
    uint256 public auctionCount;

    event AuctionDeployed(address auction, address nftContract, uint256 tokenId);

    function initialize(address _auctionImplementation) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        auctionImplementation = _auctionImplementation;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice 创建新拍卖
    function createAuction(
        address nftContract,
        uint256 tokenId,
        uint256 duration,
        address erc20Token,
        address priceFeed,
        uint256 feePercentage
    ) public returns (address) {
        address auction = Clones.clone(auctionImplementation);
        Auction(auction).initialize(nftContract, tokenId, msg.sender, duration, erc20Token, priceFeed, feePercentage);
        auctions[auctionCount] = auction;
        auctionCount += 1;

        IERC721(nftContract).safeTransferFrom(msg.sender, auction, tokenId);
        emit AuctionDeployed(auction, nftContract, tokenId);
        return auction;
    }

    /// @notice 获取所有拍卖地址
    function getAuctions() public view returns (address[] memory) {
        address[] memory result = new address[](auctionCount);
        for (uint256 i = 0; i < auctionCount; i++) {
            result[i] = auctions[i];
        }
        return result;
    }
}