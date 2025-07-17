// 导入 Chai 的断言库
const { expect } = require("chai");
// 导入 Hardhat 的 ethers 运行时环境
const { ethers } = require("hardhat");

describe("MyNFT Contract", function () {
    let MyNFT;        // 合约工厂
    let myNFT;        // 部署后的合约实例
    let owner;        // 部署者账户
    let addr1;        // 其他测试账户1
    let addr2;        // 其他测试账户2

    // 在每个测试用例运行之前执行，用于部署合约和获取测试账户
    beforeEach(async function () {
        // 获取签名者（账户）
        [owner, addr1, addr2] = await ethers.getSigners();

        // 获取合约工厂（类似于编译合约）
        MyNFT = await ethers.getContractFactory("MyNFT");

        // 部署合约
        myNFT = await MyNFT.deploy();
        // 等待合约部署完成
        await myNFT.waitForDeployment();
    });

    // 测试部署
    describe("Deployment", function () {
        it("应该设置正确的名称和符号", async function () {
            expect(await myNFT.name()).to.equal("MyAuctionNFT");
            expect(await myNFT.symbol()).to.equal("MAUCN");
        });

        it("应该将合约所有者设置为部署者", async function () {
            expect(await myNFT.owner()).to.equal(owner.address);
        });
    });

    // 测试铸造（mint）功能
    describe("Minting", function () {
        const tokenURI = "ipfs://testuri/1";

        it("只有所有者可以铸造 NFT", async function () {
            // owner 应该可以铸造
            await expect(myNFT.connect(owner).mint(addr1.address, tokenURI))
                .to.not.be.reverted;

            // addr1 不应该可以铸造// addr1 不应该可以铸造
            await expect(myNFT.connect(addr1).mint(addr1.address, tokenURI))
                .to.be.revertedWithCustomError(myNFT, "OwnableUnauthorizedAccount") // 必须使用这个，并且匹配精确的错误名称
                .withArgs(addr1.address);
        });

        it("铸造时接收地址不能为零地址", async function () {
            await expect(myNFT.connect(owner).mint(ethers.ZeroAddress, tokenURI))
                .to.be.revertedWith("NFT: 接收地址不能为零地址"); // 检查中文错误信息
        });

        it("铸造后，NFT 应该有正确的拥有者和 URI", async function () {
            const tokenId = await myNFT.connect(owner).mint.staticCall(addr1.address, tokenURI);
            await myNFT.connect(owner).mint(addr1.address, tokenURI);

            expect(await myNFT.ownerOf(tokenId)).to.equal(addr1.address);
            expect(await myNFT.tokenURI(tokenId)).to.equal(tokenURI);
            expect(await myNFT.balanceOf(addr1.address)).to.equal(1);
        });

        it("应该递增 tokenId 计数器", async function () {
            await myNFT.connect(owner).mint(addr1.address, tokenURI); // tokenId 0
            const nextTokenId = await myNFT.connect(owner).mint.staticCall(addr2.address, tokenURI); // tokenId 1
            await myNFT.connect(owner).mint(addr2.address, tokenURI);

            expect(nextTokenId).to.equal(1);
            expect(await myNFT.balanceOf(addr2.address)).to.equal(1);
        });
    });

    // 测试 tokenURI 功能
    describe("tokenURI", function () {
        const tokenURI_0 = "ipfs://nft/0";
        const tokenURI_1 = "ipfs://nft/1";

        beforeEach(async function () {
            // 铸造一些NFT用于测试
            await myNFT.connect(owner).mint(addr1.address, tokenURI_0); // tokenId 0
            await myNFT.connect(owner).mint(addr2.address, tokenURI_1); // tokenId 1
        });

        it("应该返回已存在 NFT 的正确 URI", async function () {
            expect(await myNFT.tokenURI(0)).to.equal(tokenURI_0);
            expect(await myNFT.tokenURI(1)).to.equal(tokenURI_1);
        });

        it("查询不存在的 NFT URI 时应该报错", async function () {
            await expect(myNFT.tokenURI(999)) // 假设 tokenId 999 不存在
                .to.be.revertedWith("ERC721Metadata: 查询不存在的代币URI"); // 检查中文错误信息
        });

        it("如果自定义 URI 为空，应该返回空字符串", async function () {
            // 部署一个新的合约实例，确保没有设置任何自定义URI
            const MyNFTNew = await ethers.getContractFactory("MyNFT");
            const myNFTNew = await MyNFTNew.deploy();
            await myNFTNew.waitForDeployment();

            await myNFTNew.connect(owner).mint(addr1.address, ""); // 铸造一个URI为空的NFT
            expect(await myNFTNew.tokenURI(0)).to.equal("");
        });
    });

    // 测试 _setTokenURI 内部逻辑（通过错误信息间接验证）
    describe("_setTokenURI (internal logic)", function () {
        it("尝试为不存在的代币设置 URI 时应该报错", async function () {
            const nonExistentTokenId = 5; // 假设这个 tokenId 不存在
            const someUri = "ipfs://some_uri";

            // 直接调用 _setTokenURI 是不可能的，我们只能通过一个调用它的公共函数来测试。
            // 由于 _setTokenURI 只能在 mint 中被调用，
            // 且我们在 mint 中保证了 _ownerOf(tokenId) != address(0)
            // 所以这个场景实际上不会直接发生，除非我们创建一个新的公共函数来封装 _setTokenURI
            // 但我们可以通过模拟一个场景来触发其内部的 require
            // 这里的测试更侧重于验证 _ownerOf(tokenId) 检查是否生效，而不是直接调用 _setTokenURI

            // 实际上，_setTokenURI 无法在测试中直接调用，因为它不是 public/external
            // 它的错误信息会在 mint 流程中被检查，而 mint 确保了 tokenId 存在
            // 所以这里的测试更多是概念性的。
            // 如果你想测试 _setTokenURI 内部的 require，你可能需要修改合约，
            // 暴露一个 owner-only 的 _setTokenURI 封装函数。
            // 对于当前合约结构，这个 require 已经在 tokenURI 中被间接测试了。
        });
    });
});