'use strict';

const api = {
    _config: undefined,

    config: (config) => {
        this._config = config;
    },

    static: () => {},

    init: () => {},

    pre: () => {},

    routes: () => {
        require('./lib/routes')(this._config);
    },

    post: () => {}
};

module.exports = api;
