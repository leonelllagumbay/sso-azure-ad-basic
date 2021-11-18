'use strict';

/**
 * sso-azure-ad.js controller
 *
 * @description: A set of functions called "actions" of the `sso-azure-ad` plugin.
 */

module.exports = {

  /**
   * Default action.
   *
   * @return {Object}
   */

  index: async (ctx) => {
    // Add your own logic here.

    // Send 200 `ok`
    ctx.send({
      message: 'ok'
    });
  },

  verifyTokenAzureActiveDirectory: async (ctx) => {
    await strapi.plugins['sso-azure-ad-basic'].services['sso-azure-ad-basic'].verifyTokenAzureActiveDirectory(ctx);
  },

  verifyTokenAPIUser: async (ctx) => {
    await strapi.plugins['sso-azure-ad-basic'].services['sso-azure-ad-basic'].verifyTokenAPIUser(ctx);
  }
};
