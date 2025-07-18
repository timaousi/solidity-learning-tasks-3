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
    address public nftContract; // NFT 合约地址
    uint256 public tokenId;     // 拍卖的 NFT ID
    address public seller;      // 拍卖品卖家地址
    uint256 public endTime;     // 拍卖结束时间戳
    address public highestBidder; // 当前最高出价者地址
    uint256 public highestBid;  // 当前最高出价金额
    IERC20 public erc20Token;   // 接受的 ERC20 代币合约接口
    AggregatorV3Interface public priceFeed; // Chainlink 价格预言机接口
    bool public ended;          // 拍卖是否已结束的标志
    uint256 public feePercentage; // 拍卖手续费百分比 (万分之几，例如 100 代表 1%)
    bool public highestBidIsERC20; // 标记最高出价是否为 ERC20 代币 (true 为 ERC20, false 为 ETH)

    mapping(address => uint256) public bids; // 存储每个出价者的出价金额

    event AuctionCreated(address nftContract, uint256 tokenId, uint256 duration);
    event NewBid(address bidder, uint256 amount, bool isERC20);
    event AuctionEnded(address winner, uint256 amount);

    /**
     * @notice 合约初始化函数
     */
    function initialize(
        address _nftContract,
        uint256 _tokenId,
        address _seller,
        uint256 _duration,
        address _erc20Token,
        address _priceFeed,
        uint256 _feePercentage
    ) public initializer {
        require(_duration > 0, unicode"持续时间无效");
        require(_feePercentage <= 1000, unicode"手续费百分比无效 (最大 10%)"); // 1000 = 10%

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

    /**
     * @notice UUPS 升级授权函数
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @notice 使用 ETH 进行出价
     */
    function bidETH() public payable {
        require(block.timestamp < endTime, unicode"拍卖已结束");
        require(msg.value > 0, unicode"出价金额必须大于零");
        require(msg.value > highestBid, unicode"出价必须高于当前最高出价");
        require(msg.sender != seller, unicode"卖家不能出价");

        if (highestBidder != address(0)) { // 退还上一位最高出价者的资金
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

    /**
     * @notice 使用 ERC20 代币进行出价
     * @param amount 出价金额
     */
    function bidERC20(uint256 amount) public {
        require(block.timestamp < endTime, unicode"拍卖已结束");
        require(amount > 0, unicode"出价金额必须大于零");
        require(amount > highestBid, unicode"出价必须高于当前最高出价");
        require(msg.sender != seller, unicode"卖家不能出价");

        erc20Token.transferFrom(msg.sender, address(this), amount); // 从出价者转移 ERC20 到合约

        if (highestBidder != address(0)) { // 退还上一位最高出价者的资金
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

    /**
     * @notice 获取出价金额对应的美元价值
     * @param amount 出价金额
     * @param isERC20 是否为 ERC20 代币出价
     * @return 返回美元价值
     */
    function getBidUSDValue(uint256 amount, bool isERC20) public view returns (uint256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, unicode"无效的价格数据");
        uint256 usdPrice = uint256(price) / 1e8; 
        
        // 计算美元价值：ETH 需要除以 1e18，ERC20 直接计算
        return isERC20 ? (amount * usdPrice) : (amount * usdPrice) / 1e18;
    }

    /**
     * @notice 结束拍卖并进行 NFT 和资金结算
     */
    function endAuction() public {
        require(block.timestamp >= endTime, unicode"拍卖尚未结束");
        require(!ended, unicode"拍卖已结束");
        ended = true;

        if (highestBidder != address(0)) { // 如果有最高出价者
            uint256 fee = (highestBid * feePercentage) / 10000;
            uint256 sellerAmount = highestBid - fee;

            IERC721(nftContract).safeTransferFrom(address(this), highestBidder, tokenId); // NFT 转移给赢家
            if (highestBidIsERC20) {
                erc20Token.transfer(seller, sellerAmount); // 支付 ERC20 给卖家
            } else {
                payable(seller).transfer(sellerAmount); // 支付 ETH 给卖家
            }
        } else { // 如果没有最高出价者
            IERC721(nftContract).safeTransferFrom(address(this), seller, tokenId); // NFT 退还给卖家
        }

        emit AuctionEnded(highestBidder, highestBid);
    }

    // 接收 ETH 的 fallback 函数，确保合约能接收 ETH 出价
    receive() external payable {}
}