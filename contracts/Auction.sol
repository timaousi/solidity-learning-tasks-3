// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract Auction is Initializable, OwnableUpgradeable, UUPSUpgradeable, ERC721HolderUpgradeable {
    address public nftContract;
    uint256 public tokenId;
    address public seller;
    uint256 public endTime;
    address public highestBidder;
    uint256 public highestBid;
    IERC20 public erc20Token;
    AggregatorV3Interface public priceFeed;
    bool public ended;
    uint256 public feePercentage;
    bool public highestBidIsERC20;

    mapping(address => uint256) public bids;

    event AuctionCreated(address nftContract, uint256 tokenId, uint256 duration);
    event NewBid(address bidder, uint256 amount, bool isERC20);
    event AuctionEnded(address winner, uint256 amount);

    function initialize(
        address _nftContract,
        uint256 _tokenId,
        address _seller,
        uint256 _duration,
        address _erc20Token,
        address _priceFeed,
        uint256 _feePercentage
    ) public initializer {
        require(_duration > 0, "Invalid duration"); // 添加检查
        require(_feePercentage <= 1000, "Invalid fee percentage"); // 添加检查，最大 10%
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ERC721Holder_init();

        nftContract = _nftContract;
        tokenId = _tokenId;
        seller = _seller;
        endTime = block.timestamp + _duration;
        erc20Token = IERC20(_erc20Token);
        priceFeed = AggregatorV3Interface(_priceFeed);
        feePercentage = _feePercentage;
        highestBidIsERC20 = false;

        emit AuctionCreated(_nftContract, _tokenId, _duration);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function bidETH() public payable {
        require(block.timestamp < endTime, unicode"拍卖已结束");
        require(msg.value > 0, unicode"出价金额必须大于零"); // 添加检查
        require(msg.value > highestBid, unicode"出价必须高于当前最高出价");
        require(msg.sender != seller, unicode"卖家不能出价");

        if (highestBidder != address(0)) {
            if (highestBidIsERC20) {
                erc20Token.transfer(highestBidder, bids[highestBidder]);
            } else {
                payable(highestBidder).transfer(bids[highestBidder]);
            }
        }

        bids[msg.sender] = msg.value;
        highestBidder = msg.sender;
        highestBid = msg.value;
        highestBidIsERC20 = false;

        emit NewBid(msg.sender, msg.value, false);
    }

    function bidERC20(uint256 amount) public {
        require(block.timestamp < endTime, unicode"拍卖已结束");
        require(amount > 0, unicode"出价金额必须大于零"); // 添加检查
        require(amount > highestBid, unicode"出价必须高于当前最高出价");
        require(msg.sender != seller, unicode"卖家不能出价");

        erc20Token.transferFrom(msg.sender, address(this), amount);

        if (highestBidder != address(0)) {
            if (highestBidIsERC20) {
                erc20Token.transfer(highestBidder, bids[highestBidder]);
            } else {
                payable(highestBidder).transfer(bids[highestBidder]);
            }
        }

        bids[msg.sender] = amount;
        highestBidder = msg.sender;
        highestBid = amount;
        highestBidIsERC20 = true;

        emit NewBid(msg.sender, amount, true);
    }

    function getBidUSDValue(uint256 amount, bool isERC20) public view returns (uint256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, unicode"无效的价格数据");
        uint256 usdPrice = uint256(price) / 1e8;
        return isERC20 ? (amount * usdPrice) : (amount * usdPrice) / 1e18;
    }

    function endAuction() public {
        require(block.timestamp >= endTime, unicode"拍卖尚未结束");
        require(!ended, unicode"拍卖已结束");
        ended = true;

        if (highestBidder != address(0)) {
            uint256 fee = (highestBid * feePercentage) / 10000;
            uint256 sellerAmount = highestBid - fee;

            IERC721(nftContract).safeTransferFrom(address(this), highestBidder, tokenId);
            if (highestBidIsERC20) {
                erc20Token.transfer(seller, sellerAmount);
            } else {
                payable(seller).transfer(sellerAmount);
            }
        } else {
            IERC721(nftContract).safeTransferFrom(address(this), seller, tokenId);
        }

        emit AuctionEnded(highestBidder, highestBid);
    }
}