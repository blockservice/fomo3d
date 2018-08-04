import riot from 'riot';
import route from 'riot-route';
import Ethereum from './Ethereum.js';
import Promise from 'bluebird';

/**
 * JUST.js, propietary dapp framework.
 * NSA level protection on the dreaded ctrl c + ctrl v key combo
 * We are watching you.
 * Always
 */

const Public = {
  UI: new function() {
    riot.observable(this);
  }(),
  Bridges: [],
  Cache: {},
  TimeDifference: false,

  /**
   * RiotJS route() register wrapper. Emits an event when a transition is starting. This is lacking from the base route() of riotJS, hence the need for this wrapper.
   * You can call this with exactly the same parameters as the normal route, it's nothing fancy.
   * Why? So we can have fancy state transitions.
   */
  route: function(a, b, c) {
    try {
      if (!b) {
        route(fn => {
          Public.UI.trigger('ui.transition');
          a();
        });
      } else {
        c = typeof c !== 'undefined' ? c : false;
        route(
          a,
          fn => {
            Public.UI.trigger('ui.transition');
            b();
          },
          c,
        );
      }
    } catch (e) {
      throw e;
    }
  },

  /*
	 * params.providers is the array containing all our possible API providers for interaction with the ETH blockchain.
	 * params.contracts is the array containing all of the contracts we need to interact with.
	 */
  connect: async params => {
    try {
      await Promise.map(params.providers, async instance => {
        if (instance.API) {
          Public.Bridges[instance.name] = new Ethereum.Bridge({
            web3: instance.API,
            name: instance.name,
          });
          await Promise.map(params.contracts, async contract => {
            Public.Bridges[instance.name].contracts[contract.name] = new contract.model({
              address: contract.address,
              ABI: contract.ABI,
              bridge: Public.Bridges[instance.name],
            });
          });
        }
      });
    } catch (e) {
      throw e;
    }
  },

  /**
   * Check if the network is synchronized the one of your choosing.
   * @param  {Function} fn [description]
   * @return {[type]}      [description]
   */
  checkNetwork: async fn => {
    try {
      if (!Public.Bridges.Metamask || !Public.Bridges.Metamask.signedIn) return false;
      return new Promise((res, rej) => {
        JUST.Bridges.Metamask.web3.version.getNetwork(function(r, e) {
          if (r) return rej(r);
          if (e == '1') {
            return res(true);
          } else {
            return res(true); // false
          }
        });
      });
    } catch (e) {
      throw e;
    }
  },

  /**
   * Synchronize time with the server.
   * @param  {Function} fn [description]
   * @return {[type]}      [description]
   */
  synchronizeTime: async fn => {
    //
    try {
      if (Public.TimeDifference === false) {
        let remote = await jQuery.get('https://www.imfomo.com/api/timenow');
        // let remote = { now: new Date().getTime() };
        let local = new Date().getTime();
        let diff = new Date().getTime() - remote.now;
        Public.TimeDifference = diff < 0 ? `+${diff.toString().slice(1)}` : `-${diff.toString()}`;
      }

      if (Public.TimeDifference.slice(0, 1) === '+') {
        return new Date().getTime() + parseInt(Public.TimeDifference.slice(1));
      } else {
        return new Date().getTime() - parseInt(Public.TimeDifference.slice(1));
      }
    } catch (e) {
      throw e;
    }
  },

  /**
   * Executing this function will make you regret being born.
   */
  fuckMyShitUp: function() {
    window.location = 'http://lemonparty.org';
  },

  /**
   * Get a synchronized date object.
   * @param  {Function} fn [description]
   * @return {[type]}      [description]
   */
  date: fn => {
    if (Public.TimeDifference === false) return new Date();
    if (Public.TimeDifference.slice(0, 1) == '+') {
      return new Date(new Date().getTime() + parseInt(Public.TimeDifference.slice(1)));
    } else {
      return new Date(new Date().getTime() - parseInt(Public.TimeDifference.slice(1)));
    }
  },
};

export default Public;
