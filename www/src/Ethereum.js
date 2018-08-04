import riot from 'riot';
import w3Constructor from 'web3';
import Promise from 'bluebird';
import JUST from './JUST';
import merge from 'lodash/merge';

// Contract = function(params){

// 	// add riotjs compatible event listener
// 	riot.observable(this)

// 	// default options merger with params
// 	this.options = _.merge({

// 	}, params)
// }

class Bridge {
  constructor(params) {
    var $this = this;
    riot.observable(this);
    this.listeners = {};
    this.contracts = [];
    this._lastWallet = [];
    this.name = params.name;
    this.options = merge(
      {
        web3: false,
      },
      params,
    );

    if (!this.options.web3) {
      throw 'MissingParam: Please provide a web3 parameter to interact with. This can either be a string pointing to the HTTP RPC, or a pre-constructed web3 instance.';
    }

    if (typeof this.options.web3 === 'string') {
      this.web3 = new w3Constructor(new w3Constructor.providers.HttpProvider(this.options.web3));
    } else {
      this.web3 = this.options.web3;
    }

    this.signedIn = this.web3.eth.defaultAccount ? true : false;
    if (this.signedIn) this._lastWallet = this.web3.eth.defaultAccount;

    if (this.name === 'Metamask') {
      this.listeners.signedIn = setInterval(function() {
        if ($this._lastWallet !== $this.web3.eth.defaultAccount) {
          $this.trigger('status.signedIn', !this.signedIn);
          $this.signedIn = $this.web3.eth.defaultAccount ? true : false;
          $this._lastWallet = $this.web3.eth.defaultAccount;
        }
      }, 5000);
    }
  }

  wallet() {
    if (this.web3.version.api && this.web3.version.api.includes('0.2')) {
      return this.web3.eth.defaultAccount;
    } else if (this.web3.version.includes('1.')) {
      return this.web3.eth.defaultAccount;
    } else {
      throw 'InvalidType: Unrecognized web3js version. Are you sure this is a web3js instance?';
    }
  }
}

/**
 * Universal contract wrapper contract to interface with the blockchain.
 * Can use a myriad of different sourced bridge providers.
 */
class Contract {
  constructor(params) {
    riot.observable(this);
    this.options = merge(
      {
        address: false,
        bridge: false,
        ABI: false,
        API: false,
        name: 'Contract',
      },
      params,
    );

    this.listeners = {};

    this.name = this.options.name;

    if (!this.options.bridge) {
      throw 'MissingParam: Please provide a bridge object to attach to.';
    }

    if (typeof this.options.bridge !== 'object') {
      throw 'InvalidType: Please provide a valid bridge object to attach to.';
    } else {
      this.bridge = this.options.bridge;
    }

    if (this.bridge.web3.version.api && this.bridge.web3.version.api.includes('0.2')) {
      this.API = this.bridge.web3.eth.contract(this.options.ABI).at(this.options.address);
    } else if (this.bridge.web3.version.includes('1.')) {
      this.API = new this.bridge.web3.eth.Contract(this.options.ABI, this.options.address);
    } else {
      throw 'InvalidType: Unrecognized web3js version. Are you sure this is a web3js instance?';
    }
  }

  /**
   * Perform a read call on a specific accessor.
   * @param  {Function} fn     [description]
   * @param  {[type]}   params [description]
   * @return {[type]}          [description]
   */
  async read(fn, params) {
    if (this.bridge.web3.version.api && this.bridge.web3.version.api.includes('0.2')) {
      if (!params || typeof params === 'undefined') params = [];
      if (!Array.isArray(params)) params = [params];
      return new Promise((res, rej) => {
        params.push(function(err, data) {
          if (err) return rej(err);
          return res(data);
        });
        this.API[fn].apply(null, params);
      });
    } else if (this.bridge.web3.version.includes('1.')) {
      if (!params || typeof params === 'undefined') params = [];
      if (!Array.isArray(params)) params = [params];
      try {
        return this.API.methods[fn].apply(null, params).call();
      } catch (e) {
        console.error(`Unknown method "${fn}" in contract "${this.name}".`);
      }
    } else {
      throw 'InvalidType: Unrecognized web3js version. Are you sure this is a web3js instance?';
    }
  }

  /**
   * Perform a read call on a specific accessor.
   * @param  {Function} fn     [description]
   * @param  {[type]}   params [description]
   * @return {[type]}          [description]
   */
  async write(fn, params, metadata) {
    if (this.bridge.web3.version.api && this.bridge.web3.version.api.includes('0.2')) {
      if (!params || typeof params === 'undefined') params = [];
      if (!Array.isArray(params)) params = [params];
      return new Promise((res, rej) => {
        if (metadata && typeof metadata === 'object') params.push(metadata);
        params.push(function(err, data) {
          if (err) return rej(err);
          return res(data);
        });
        try {
          this.API[fn].apply(null, params);
        } catch (e) {
          console.error(`Unknown method "${fn}" in contract "${this.name}".`);
        }
      });
    } else if (this.bridge.web3.version.includes('1.')) {
      if (!params || typeof params === 'undefined') params = [];
      if (!Array.isArray(params)) params = [params];
      if (!metadata || typeof metadata !== 'object') metadata = {};
      try {
        return this.API.methods[fn].apply(null, params).send(metadata);
      } catch (e) {
        console.error(`Unknown method "${fn}" in contract "${this.name}".`);
      }
    } else {
      throw 'InvalidType: Unrecognized web3js version. Are you sure this is a web3js instance?';
    }
  }

  /**
   * Setup listeners
   */
  async listen() {
    var $this = this;
    if (!this.bridge.web3.version.includes('1.'))
      throw 'InvalidVersion: This version of web3js does not support events';
    if (this.listeners.ws) this.listeners.ws.unsubscribe();
    try {
      console.log('Setting up event listeners..');
      this.listeners.ws = this.API.events.allEvents(function(err, event, sub) {
        console.log('incoming..');
        var tt = typeof err;
        console.log('Bridge reporting', err, event, sub, tt);
        if (err) {
          console.log('closing and reopening..', err, event, sub);
          this.listen();
          return;
        } else {
          //if(Bridge.cache.skip[event.transactionHash] == 1) return
          $this.trigger('transaction', event);
          //Bridge.cache.skip[event.transactionHash] = 1
        }
      });
    } catch (e) {
      console.log(e);
      //Bridge.methods.connectWithBlockchain()
      return;
    }
  }
}

class P3D extends Contract {
  constructor(params) {
    super(
      merge(
        {
          name: 'P3D',
          ABI: [
            {
              constant: true,
              inputs: [{ name: '_customerAddress', type: 'address' }],
              name: 'dividendsOf',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'name',
              outputs: [{ name: '', type: 'string' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '_ethereumToSpend', type: 'uint256' }],
              name: 'calculateTokensReceived',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'totalSupply',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '_tokensToSell', type: 'uint256' }],
              name: 'calculateEthereumReceived',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'onlyAmbassadors',
              outputs: [{ name: '', type: 'bool' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'decimals',
              outputs: [{ name: '', type: 'uint8' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '', type: 'bytes32' }],
              name: 'administrators',
              outputs: [{ name: '', type: 'bool' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: false,
              inputs: [],
              name: 'withdraw',
              outputs: [],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'sellPrice',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'stakingRequirement',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '_includeReferralBonus', type: 'bool' }],
              name: 'myDividends',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'totalEthereumBalance',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '_customerAddress', type: 'address' }],
              name: 'balanceOf',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: false,
              inputs: [{ name: '_amountOfTokens', type: 'uint256' }],
              name: 'setStakingRequirement',
              outputs: [],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'buyPrice',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: false,
              inputs: [{ name: '_identifier', type: 'bytes32' }, { name: '_status', type: 'bool' }],
              name: 'setAdministrator',
              outputs: [],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'myTokens',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'symbol',
              outputs: [{ name: '', type: 'string' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: false,
              inputs: [],
              name: 'disableInitialStage',
              outputs: [],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            {
              constant: false,
              inputs: [{ name: '_toAddress', type: 'address' }, { name: '_amountOfTokens', type: 'uint256' }],
              name: 'transfer',
              outputs: [{ name: '', type: 'bool' }],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            {
              constant: false,
              inputs: [{ name: '_symbol', type: 'string' }],
              name: 'setSymbol',
              outputs: [],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            {
              constant: false,
              inputs: [{ name: '_name', type: 'string' }],
              name: 'setName',
              outputs: [],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            {
              constant: false,
              inputs: [{ name: '_amountOfTokens', type: 'uint256' }],
              name: 'sell',
              outputs: [],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            {
              constant: false,
              inputs: [],
              name: 'exit',
              outputs: [],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            {
              constant: false,
              inputs: [{ name: '_referredBy', type: 'address' }],
              name: 'buy',
              outputs: [{ name: '', type: 'uint256' }],
              payable: true,
              stateMutability: 'payable',
              type: 'function',
            },
            {
              constant: false,
              inputs: [],
              name: 'reinvest',
              outputs: [],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            { inputs: [], payable: false, stateMutability: 'nonpayable', type: 'constructor' },
            { payable: true, stateMutability: 'payable', type: 'fallback' },
            {
              anonymous: false,
              inputs: [
                { indexed: true, name: 'customerAddress', type: 'address' },
                { indexed: false, name: 'incomingEthereum', type: 'uint256' },
                { indexed: false, name: 'tokensMinted', type: 'uint256' },
                { indexed: true, name: 'referredBy', type: 'address' },
              ],
              name: 'onTokenPurchase',
              type: 'event',
            },
            {
              anonymous: false,
              inputs: [
                { indexed: true, name: 'customerAddress', type: 'address' },
                { indexed: false, name: 'tokensBurned', type: 'uint256' },
                { indexed: false, name: 'ethereumEarned', type: 'uint256' },
              ],
              name: 'onTokenSell',
              type: 'event',
            },
            {
              anonymous: false,
              inputs: [
                { indexed: true, name: 'customerAddress', type: 'address' },
                { indexed: false, name: 'ethereumReinvested', type: 'uint256' },
                { indexed: false, name: 'tokensMinted', type: 'uint256' },
              ],
              name: 'onReinvestment',
              type: 'event',
            },
            {
              anonymous: false,
              inputs: [
                { indexed: true, name: 'customerAddress', type: 'address' },
                { indexed: false, name: 'ethereumWithdrawn', type: 'uint256' },
              ],
              name: 'onWithdraw',
              type: 'event',
            },
            {
              anonymous: false,
              inputs: [
                { indexed: true, name: 'from', type: 'address' },
                { indexed: true, name: 'to', type: 'address' },
                { indexed: false, name: 'tokens', type: 'uint256' },
              ],
              name: 'Transfer',
              type: 'event',
            },
          ],
        },
        params,
      ),
    );
  }
}

class Fomo3D extends Contract {
  constructor(params) {
    super(
      merge(
        {
          name: 'Fomo3D',
          ABI: [
            {
              constant: true,
              inputs: [],
              name: 'getBuyPrice',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'name',
              outputs: [{ name: '', type: 'string' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: false,
              inputs: [
                { name: '_affCode', type: 'bytes32' },
                { name: '_team', type: 'uint256' },
                { name: '_eth', type: 'uint256' },
              ],
              name: 'reLoadXname',
              outputs: [],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            {
              constant: false,
              inputs: [],
              name: 'activate',
              outputs: [],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '', type: 'address' }],
              name: 'pIDxAddr_',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'airDropTracker_',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '', type: 'uint256' }],
              name: 'round_',
              outputs: [
                { name: 'plyr', type: 'uint256' },
                { name: 'team', type: 'uint256' },
                { name: 'end', type: 'uint256' },
                { name: 'ended', type: 'bool' },
                { name: 'strt', type: 'uint256' },
                { name: 'keys', type: 'uint256' },
                { name: 'eth', type: 'uint256' },
                { name: 'pot', type: 'uint256' },
                { name: 'mask', type: 'uint256' },
                { name: 'ico', type: 'uint256' },
                { name: 'icoGen', type: 'uint256' },
                { name: 'icoAvg', type: 'uint256' },
              ],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '', type: 'uint256' }, { name: '', type: 'bytes32' }],
              name: 'plyrNames_',
              outputs: [{ name: '', type: 'bool' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '', type: 'uint256' }],
              name: 'fees_',
              outputs: [{ name: 'gen', type: 'uint256' }, { name: 'p3d', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '', type: 'bytes32' }],
              name: 'pIDxName_',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: false,
              inputs: [
                { name: '_affCode', type: 'uint256' },
                { name: '_team', type: 'uint256' },
                { name: '_eth', type: 'uint256' },
              ],
              name: 'reLoadXid',
              outputs: [],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            {
              constant: false,
              inputs: [],
              name: 'withdraw',
              outputs: [],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            {
              constant: false,
              inputs: [
                { name: '_nameString', type: 'string' },
                { name: '_affCode', type: 'address' },
                { name: '_all', type: 'bool' },
              ],
              name: 'registerNameXaddr',
              outputs: [],
              payable: true,
              stateMutability: 'payable',
              type: 'function',
            },
            {
              constant: false,
              inputs: [
                { name: '_pID', type: 'uint256' },
                { name: '_addr', type: 'address' },
                { name: '_name', type: 'bytes32' },
                { name: '_laff', type: 'uint256' },
              ],
              name: 'receivePlayerInfo',
              outputs: [],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '', type: 'uint256' }, { name: '', type: 'uint256' }],
              name: 'rndTmEth_',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'rID_',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '_pID', type: 'uint256' }],
              name: 'getPlayerVaults',
              outputs: [{ name: '', type: 'uint256' }, { name: '', type: 'uint256' }, { name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: false,
              inputs: [
                { name: '_nameString', type: 'string' },
                { name: '_affCode', type: 'bytes32' },
                { name: '_all', type: 'bool' },
              ],
              name: 'registerNameXname',
              outputs: [],
              payable: true,
              stateMutability: 'payable',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'getCurrentRoundInfo',
              outputs: [
                { name: '', type: 'uint256' },
                { name: '', type: 'uint256' },
                { name: '', type: 'uint256' },
                { name: '', type: 'uint256' },
                { name: '', type: 'uint256' },
                { name: '', type: 'uint256' },
                { name: '', type: 'uint256' },
                { name: '', type: 'address' },
                { name: '', type: 'bytes32' },
                { name: '', type: 'uint256' },
                { name: '', type: 'uint256' },
                { name: '', type: 'uint256' },
                { name: '', type: 'uint256' },
                { name: '', type: 'uint256' },
              ],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: false,
              inputs: [
                { name: '_affCode', type: 'address' },
                { name: '_team', type: 'uint256' },
                { name: '_eth', type: 'uint256' },
              ],
              name: 'reLoadXaddr',
              outputs: [],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            {
              constant: false,
              inputs: [{ name: '_affCode', type: 'uint256' }, { name: '_team', type: 'uint256' }],
              name: 'buyXid',
              outputs: [],
              payable: true,
              stateMutability: 'payable',
              type: 'function',
            },
            {
              constant: false,
              inputs: [{ name: '_pID', type: 'uint256' }, { name: '_name', type: 'bytes32' }],
              name: 'receivePlayerNameList',
              outputs: [],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            {
              constant: false,
              inputs: [
                { name: '_nameString', type: 'string' },
                { name: '_affCode', type: 'uint256' },
                { name: '_all', type: 'bool' },
              ],
              name: 'registerNameXID',
              outputs: [],
              payable: true,
              stateMutability: 'payable',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'symbol',
              outputs: [{ name: '', type: 'string' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: false,
              inputs: [{ name: '_affCode', type: 'address' }, { name: '_team', type: 'uint256' }],
              name: 'buyXaddr',
              outputs: [],
              payable: true,
              stateMutability: 'payable',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '', type: 'uint256' }, { name: '', type: 'uint256' }],
              name: 'plyrRnds_',
              outputs: [
                { name: 'eth', type: 'uint256' },
                { name: 'keys', type: 'uint256' },
                { name: 'mask', type: 'uint256' },
                { name: 'ico', type: 'uint256' },
              ],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: false,
              inputs: [{ name: '_affCode', type: 'bytes32' }, { name: '_team', type: 'uint256' }],
              name: 'buyXname',
              outputs: [],
              payable: true,
              stateMutability: 'payable',
              type: 'function',
            },
            {
              constant: false,
              inputs: [{ name: '_otherF3D', type: 'address' }],
              name: 'setOtherFomo',
              outputs: [],
              payable: false,
              stateMutability: 'nonpayable',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '', type: 'uint256' }],
              name: 'potSplit_',
              outputs: [{ name: 'gen', type: 'uint256' }, { name: 'p3d', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'getTimeLeft',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '_rID', type: 'uint256' }, { name: '_eth', type: 'uint256' }],
              name: 'calcKeysReceived',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '_keys', type: 'uint256' }],
              name: 'iWantXKeys',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'activated_',
              outputs: [{ name: '', type: 'bool' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [],
              name: 'airDropPot_',
              outputs: [{ name: '', type: 'uint256' }],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '', type: 'uint256' }],
              name: 'plyr_',
              outputs: [
                { name: 'addr', type: 'address' },
                { name: 'name', type: 'bytes32' },
                { name: 'win', type: 'uint256' },
                { name: 'gen', type: 'uint256' },
                { name: 'aff', type: 'uint256' },
                { name: 'lrnd', type: 'uint256' },
                { name: 'laff', type: 'uint256' },
              ],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            {
              constant: false,
              inputs: [],
              name: 'potSwap',
              outputs: [],
              payable: true,
              stateMutability: 'payable',
              type: 'function',
            },
            {
              constant: true,
              inputs: [{ name: '_addr', type: 'address' }],
              name: 'getPlayerInfoByAddress',
              outputs: [
                { name: '', type: 'uint256' },
                { name: '', type: 'bytes32' },
                { name: '', type: 'uint256' },
                { name: '', type: 'uint256' },
                { name: '', type: 'uint256' },
                { name: '', type: 'uint256' },
                { name: '', type: 'uint256' },
              ],
              payable: false,
              stateMutability: 'view',
              type: 'function',
            },
            { inputs: [], payable: false, stateMutability: 'nonpayable', type: 'constructor' },
            { payable: true, stateMutability: 'payable', type: 'fallback' },
            {
              anonymous: false,
              inputs: [
                { indexed: true, name: 'playerID', type: 'uint256' },
                { indexed: true, name: 'playerAddress', type: 'address' },
                { indexed: true, name: 'playerName', type: 'bytes32' },
                { indexed: false, name: 'isNewPlayer', type: 'bool' },
                { indexed: false, name: 'affiliateID', type: 'uint256' },
                { indexed: false, name: 'affiliateAddress', type: 'address' },
                { indexed: false, name: 'affiliateName', type: 'bytes32' },
                { indexed: false, name: 'amountPaid', type: 'uint256' },
                { indexed: false, name: 'timeStamp', type: 'uint256' },
              ],
              name: 'onNewName',
              type: 'event',
            },
            {
              anonymous: false,
              inputs: [
                { indexed: false, name: 'compressedData', type: 'uint256' },
                { indexed: false, name: 'compressedIDs', type: 'uint256' },
                { indexed: false, name: 'playerName', type: 'bytes32' },
                { indexed: false, name: 'playerAddress', type: 'address' },
                { indexed: false, name: 'ethIn', type: 'uint256' },
                { indexed: false, name: 'keysBought', type: 'uint256' },
                { indexed: false, name: 'winnerAddr', type: 'address' },
                { indexed: false, name: 'winnerName', type: 'bytes32' },
                { indexed: false, name: 'amountWon', type: 'uint256' },
                { indexed: false, name: 'newPot', type: 'uint256' },
                { indexed: false, name: 'P3DAmount', type: 'uint256' },
                { indexed: false, name: 'genAmount', type: 'uint256' },
                { indexed: false, name: 'potAmount', type: 'uint256' },
                { indexed: false, name: 'airDropPot', type: 'uint256' },
              ],
              name: 'onEndTx',
              type: 'event',
            },
            {
              anonymous: false,
              inputs: [
                { indexed: true, name: 'playerID', type: 'uint256' },
                { indexed: false, name: 'playerAddress', type: 'address' },
                { indexed: false, name: 'playerName', type: 'bytes32' },
                { indexed: false, name: 'ethOut', type: 'uint256' },
                { indexed: false, name: 'timeStamp', type: 'uint256' },
              ],
              name: 'onWithdraw',
              type: 'event',
            },
            {
              anonymous: false,
              inputs: [
                { indexed: false, name: 'playerAddress', type: 'address' },
                { indexed: false, name: 'playerName', type: 'bytes32' },
                { indexed: false, name: 'ethOut', type: 'uint256' },
                { indexed: false, name: 'compressedData', type: 'uint256' },
                { indexed: false, name: 'compressedIDs', type: 'uint256' },
                { indexed: false, name: 'winnerAddr', type: 'address' },
                { indexed: false, name: 'winnerName', type: 'bytes32' },
                { indexed: false, name: 'amountWon', type: 'uint256' },
                { indexed: false, name: 'newPot', type: 'uint256' },
                { indexed: false, name: 'P3DAmount', type: 'uint256' },
                { indexed: false, name: 'genAmount', type: 'uint256' },
              ],
              name: 'onWithdrawAndDistribute',
              type: 'event',
            },
            {
              anonymous: false,
              inputs: [
                { indexed: false, name: 'playerAddress', type: 'address' },
                { indexed: false, name: 'playerName', type: 'bytes32' },
                { indexed: false, name: 'ethIn', type: 'uint256' },
                { indexed: false, name: 'compressedData', type: 'uint256' },
                { indexed: false, name: 'compressedIDs', type: 'uint256' },
                { indexed: false, name: 'winnerAddr', type: 'address' },
                { indexed: false, name: 'winnerName', type: 'bytes32' },
                { indexed: false, name: 'amountWon', type: 'uint256' },
                { indexed: false, name: 'newPot', type: 'uint256' },
                { indexed: false, name: 'P3DAmount', type: 'uint256' },
                { indexed: false, name: 'genAmount', type: 'uint256' },
              ],
              name: 'onBuyAndDistribute',
              type: 'event',
            },
            {
              anonymous: false,
              inputs: [
                { indexed: false, name: 'playerAddress', type: 'address' },
                { indexed: false, name: 'playerName', type: 'bytes32' },
                { indexed: false, name: 'compressedData', type: 'uint256' },
                { indexed: false, name: 'compressedIDs', type: 'uint256' },
                { indexed: false, name: 'winnerAddr', type: 'address' },
                { indexed: false, name: 'winnerName', type: 'bytes32' },
                { indexed: false, name: 'amountWon', type: 'uint256' },
                { indexed: false, name: 'newPot', type: 'uint256' },
                { indexed: false, name: 'P3DAmount', type: 'uint256' },
                { indexed: false, name: 'genAmount', type: 'uint256' },
              ],
              name: 'onReLoadAndDistribute',
              type: 'event',
            },
            {
              anonymous: false,
              inputs: [
                { indexed: true, name: 'affiliateID', type: 'uint256' },
                { indexed: false, name: 'affiliateAddress', type: 'address' },
                { indexed: false, name: 'affiliateName', type: 'bytes32' },
                { indexed: true, name: 'roundID', type: 'uint256' },
                { indexed: true, name: 'buyerID', type: 'uint256' },
                { indexed: false, name: 'amount', type: 'uint256' },
                { indexed: false, name: 'timeStamp', type: 'uint256' },
              ],
              name: 'onAffiliatePayout',
              type: 'event',
            },
            {
              anonymous: false,
              inputs: [
                { indexed: false, name: 'roundID', type: 'uint256' },
                { indexed: false, name: 'amountAddedToPot', type: 'uint256' },
              ],
              name: 'onPotSwapDeposit',
              type: 'event',
            },
          ],
        },
        params,
      ),
    );

    this.lastBlock = 0;
  }

  async getCurrentPlayer() {
    if (!this.bridge.signedIn) return false;

    // fetch player ID
    let PID = await this.read('pIDxAddr_', this.bridge.wallet());

    // fetch round information
    let roundInformation = await this.read('getPlayerInfoByAddress', this.bridge.wallet());

    // fetch vaults
    let vaultInformation = await this.read('getPlayerVaults', PID);

    // cache information
    return {
      PID: PID,
      Vaults: await JUST.Bridges.Metamask.contracts.Fomo3D.read('getPlayerVaults', PID),
      Round: roundInformation,
    };
  }

  async purchaseKeys(amount, team, reinvest) {
    let masternode =
      localStorage.getItem('masternode') && JSON.parse(localStorage.getItem('masternode'))
        ? JSON.parse(localStorage.getItem('masternode'))
        : false;
    let prefix = reinvest ? `reLoad` : `buy`;
    if (masternode) {
      switch (masternode.type) {
        case 'address':
          return reinvest
            ? this.write(`${prefix}Xaddr`, [masternode.value, team, amount])
            : this.write(`${prefix}Xaddr`, [masternode.value, team], { value: amount });
          break;
        case 'id':
          return reinvest
            ? this.write(`${prefix}Xid`, [masternode.value, team, amount])
            : this.write(`${prefix}Xid`, [masternode.value, team], { value: amount });
          break;
        case 'name':
          return reinvest
            ? this.write(`${prefix}Xname`, [
                web3.fromAscii(JSON.parse(localStorage.getItem('masternode')).value),
                team,
                amount,
              ])
            : this.write(
                `${prefix}Xname`,
                [web3.fromAscii(JSON.parse(localStorage.getItem('masternode')).value), team],
                { value: amount },
              );
          break;
      }
    } else {
      return reinvest
        ? this.write(`${prefix}Xid`, [0, team, amount])
        : this.write(`${prefix}Xaddr`, ['0', team], { value: amount });
    }
  }

  async enableRefresher() {
    var $this = this;
    let _blockData = await JUST.Bridges.Browser.web3.eth.getBlock('latest');
    //console.log(_blockData, this)
    $this.lastBlock = _blockData.number;

    setInterval(async e => {
      let _blockData = await JUST.Bridges.Browser.web3.eth.getBlock('latest', true);

      if ($this.lastBlock != _blockData.number) {
        JUST.UI.trigger('ui.refresh');
        $this.lastBlock = _blockData.number;
      }
    }, 5000);
  }
}

// Bridge = _.merge(riot.observable(), {
// 	props : {
// 		Address: "0xdb5efaa964784cd8ab44dc46020998c3ba0235fe",
// 		ABI: [{"constant":true,"inputs":[{"name":"_betInstanceID","type":"uint256"}],"name":"getBetAnswers","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"withdrawDeveloperFunds","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_betInstanceID","type":"uint256"}],"name":"withdrawStake","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"betInstances","outputs":[{"name":"name","type":"string"},{"name":"feeRateStart","type":"uint256"},{"name":"feeRateEnd","type":"uint256"},{"name":"disabled","type":"bool"},{"name":"opensAt","type":"uint256"},{"name":"closesAt","type":"uint256"},{"name":"finishesAt","type":"uint256"},{"name":"winningAnswer","type":"uint256"},{"name":"coinRate","type":"uint256"},{"name":"winnerDeclared","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_betInstanceID","type":"uint256"},{"name":"_answer","type":"uint256"}],"name":"declareWinningAnswer","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_betInstanceID","type":"uint256"},{"name":"_answer","type":"string"}],"name":"createAnswer","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_betInstanceID","type":"uint256"}],"name":"disableBet","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"string"},{"name":"_feeRateStart","type":"uint256"},{"name":"_feeRateEnd","type":"uint256"},{"name":"_coinRate","type":"uint256"},{"name":"_opensAt","type":"uint256"},{"name":"_closesAt","type":"uint256"},{"name":"_finishesAt","type":"uint256"},{"name":"_answerOne","type":"string"},{"name":"_answerTwo","type":"string"},{"name":"_answerThree","type":"string"}],"name":"createBet","outputs":[{"name":"_betInstanceID","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_betInstanceID","type":"uint256"}],"name":"getBetStatus","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_betInstanceID","type":"uint256"},{"name":"_answer","type":"uint256"},{"name":"_referredBy","type":"address"}],"name":"setStake","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"_betInstanceID","type":"uint256"}],"name":"withdrawEarnings","outputs":[{"name":"_earnings","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_betInstanceID","type":"uint256"},{"name":"_timestampCurrent","type":"uint256"}],"name":"calculateFeePercentage","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_betInstanceID","type":"uint256"},{"name":"_answer","type":"uint256"}],"name":"getBetStaked","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"string"},{"name":"_feeRateStart","type":"uint256"},{"name":"_feeRateEnd","type":"uint256"},{"name":"_coinRate","type":"uint256"},{"name":"_opensAt","type":"uint256"},{"name":"_closesAt","type":"uint256"},{"name":"_finishesAt","type":"uint256"}],"name":"createBet","outputs":[{"name":"_betInstanceID","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_betInstanceID","type":"uint256"},{"name":"_answer","type":"uint256"},{"name":"_stake","type":"uint256"}],"name":"calculateEarnings","outputs":[{"name":"_earnings","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_betInstanceID","type":"uint256"},{"name":"_answer","type":"uint256"}],"name":"getBetAnswer","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getBetInstances","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"uint256"}],"name":"playerBets","outputs":[{"name":"answer","type":"uint256"},{"name":"stake","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"FooMath","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"string"},{"name":"_feeRateStart","type":"uint256"},{"name":"_feeRateEnd","type":"uint256"},{"name":"_coinRate","type":"uint256"},{"name":"_opensAt","type":"uint256"},{"name":"_closesAt","type":"uint256"},{"name":"_finishesAt","type":"uint256"},{"name":"_answerOne","type":"string"},{"name":"_answerTwo","type":"string"}],"name":"createBet","outputs":[{"name":"_betInstanceID","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_betInstanceID","type":"uint256"}],"name":"getBetPlayers","outputs":[{"name":"","type":"uint256[]"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"name":"_gambleCoinAddress","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_betInstanceID","type":"uint256"}],"name":"onBetOpen","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_betInstanceID","type":"uint256"},{"indexed":false,"name":"_winningAnswer","type":"uint256"}],"name":"onBetWon","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_betInstanceID","type":"uint256"}],"name":"onBetDisabled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"betInstanceID","type":"uint256"},{"indexed":true,"name":"answer","type":"uint256"},{"indexed":false,"name":"stake","type":"uint256"},{"indexed":true,"name":"referredBy","type":"address"},{"indexed":false,"name":"sender","type":"address"}],"name":"onSetStake","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"betInstanceID","type":"uint256"},{"indexed":true,"name":"answer","type":"uint256"},{"indexed":false,"name":"stake","type":"uint256"},{"indexed":false,"name":"sender","type":"address"}],"name":"onWithdrawStake","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"betInstanceID","type":"uint256"},{"indexed":true,"name":"answer","type":"uint256"},{"indexed":false,"name":"stake","type":"uint256"},{"indexed":false,"name":"sender","type":"address"}],"name":"onWithdrawEarnings","type":"event"}],
// 		PersonalContract: null,
// 		Web3: null,
// 		Infura: null,
// 		HTTPContract: null,
// 		WS: null,
// 		WSContract: null,
// 		signedIn: false,
// 		blockchainFetcher: false,
// 		blockchainData: {},
// 		Provider: 'https://testnet.powh.io/',
// 		EL: null
// 	},

// 	cache: {

// 	},

// 	methods: {
// 		checkIfSignedIn: function(){
// 			if(typeof web3 === "undefined" || typeof web3.eth.defaultAccount === "undefined" ){
// 				console.log('no sign in')
// 				console.log(web3)
// 				Bridge.props.signedIn = false
// 			} else {
// 				Bridge.props.Web3 = web3
// 				Bridge.props.signedIn = true
// 				Bridge.props.PersonalContract = Bridge.props.Web3.eth.contract(Bridge.props.ABI).at(Bridge.props.Address)
// 			}
// 		},
// 		connectWithBlockchain: function(){
// 			try {

// 				// Bridge.methods.checkIfSignedIn()
// 				// Bridge.props.Infura = new w3Constructor(   new w3Constructor.providers.HttpProvider(`https://${Bridge.props.Provider}.infura.io/DSVLmcZRJBNSVSe3SAwg`) )
// 				// Bridge.props.WS = new w3Constructor(   new w3Constructor.providers.WebsocketProvider(`wss://${Bridge.props.Provider}.infura.io/ws`) )
// 				// Bridge.props.HTTPContract = new Bridge.props.Infura.eth.Contract(Bridge.props.ABI, Bridge.props.Address)
// 				// Bridge.props.WSContract = new Bridge.props.WS.eth.Contract(Bridge.props.ABI, Bridge.props.Address)

// 				Bridge.methods.bindEvents()

// 				return Promise.resolve(true)
// 			} catch(e) {
// 				console.log("errored", e)
// 				//Bridge.methods.connectWithBlockchain()
// 			}
// 		},

// 		bindEvents: function(){
// 			if(Bridge.props.EL) Bridge.props.EL.unsubscribe()
// 			try {
// 				console.log("Setting up event listeners..")
// 				Bridge.props.EL = Bridge.props.WSContract.events.allEvents(function(err, event, sub){
// 					console.log("incoming..")
// 					var tt = typeof err
// 					console.log("Bridge reporting", err, event, sub, tt)
// 					if(err){
// 						console.log("closing and reopening..", err, event, sub)
// 						Bridge.methods.connectWithBlockchain()
// 						return
// 					} else {
// 						if(Bridge.cache.skip[event.transactionHash] == 1) return
// 						Bridge.trigger('transaction', event)
// 						Bridge.cache.skip[event.transactionHash] = 1
// 					}
// 				})
// 			} catch(e) {
// 				console.log(e)
// 				//Bridge.methods.connectWithBlockchain()
// 				return
// 			}
// 		}
// 	}

// })

export default {
  Bridge: Bridge,
  Contract: Contract,
  Fomo3D: Fomo3D,
  P3D,
};
