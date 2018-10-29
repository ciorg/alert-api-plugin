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
        require('./lib/index')(this._config);
    },

    post: () => {}
};

module.exports = api;
