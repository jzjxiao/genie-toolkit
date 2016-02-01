// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');
const express = require('express');

const user = require('../util/user');
const feeds = require('../../shared/util/feeds');
const EngineManager = require('../enginemanager');

const ThingTalk = require('thingtalk');
const AppCompiler = ThingTalk.Compiler;

var router = express.Router();

function appsList(req, res, next, message) {
    EngineManager.get().getEngine(req.user.id).then(function(engine) {
        return engine.apps.getAllApps();
    }).then(function(apps) {
        return Q.all(apps.map(function(a) {
            return Q.all([a.uniqueId, a.name, a.isRunning, a.isEnabled,
                          a.currentTier])
                .spread(function(uniqueId, name, isRunning, isEnabled, currentTier) {
                    return { uniqueId: uniqueId, name: name || "Some app",
                             running: isRunning, enabled: isEnabled,
                             currentTier: currentTier };
                });
        }));
    }).then(function(appinfo) {
        res.render('apps_list', { page_title: 'ThingEngine - installed apps',
                                  message: message,
                                  csrfToken: req.csrfToken(),
                                  apps: appinfo });
    }).catch(function(e) {
        res.status(400).render('error', { page_title: "ThingEngine - Error",
                                          message: e.message });
    }).done();
}

router.get('/', user.redirectLogIn, function(req, res, next) {
    appsList(req, res, next, '');
});

function appsCreate(error, req, res) {
    return EngineManager.get().getEngine(req.user.id).then(function(engine) {
        return feeds.getFeedList(engine, true);
    }).then(function(feeds) {
        res.render('apps_create', { page_title: 'ThingEngine - create app',
                                    csrfToken: req.csrfToken(),
                                    error: error,
                                    code: req.body.code,
                                    parameters: req.body.params || '{}',
                                    tier: req.body.tier || 'cloud',
                                    omlet: { feeds: feeds,
                                             feedId: req.body.feedId }
                                  });
    });
}

router.get('/create', user.redirectLogIn, function(req, res, next) {
    appsCreate(undefined, req, res).catch(function(e) {
        res.status(400).render('error', { page_title: "ThingEngine - Error",
                                          message: e.message });
    }).done();
});

router.post('/create', user.requireLogIn, function(req, res, next) {
    Q.try(function() {
        return EngineManager.get().getEngine(req.user.id).then(function(engine) {
            var code = req.body.code;
            var state, tier;

            return engine.devices.schemas.then(function(schemaRetriever) {
                var compiler = new AppCompiler();
                compiler.setSchemaRetriever(schemaRetriever);

                return Q.try(function() {
                    // sanity check the app
                    return compiler.compileCode(code);
                }).then(function() {
                    state = JSON.parse(req.body.params);
                    if (compiler.feedAccess) {
                        if (!state.$F && !req.body.feedId)
                            throw new Error('Missing feed for feed-shared app');
                        if (!state.$F)
                            state.$F = req.body.feedId;
                    } else {
                        delete state.$F;
                    }

                    tier = req.body.tier;
                    if (tier !== 'server' && tier !== 'cloud' && tier !== 'phone')
                        throw new Error('No such tier ' + tier);
                })
            }).then(function() {
                return engine.apps.loadOneApp(code, state, null, tier, true);
            });
        }).then(function() {
            appsList(req, res, next, "Application successfully created");
        }).catch(function(e) {
            return appsCreate(e.message, req, res);
        });
    }).catch(function(e) {
        res.status(400).render('error', { page_title: "ThingEngine - Error",
                                          message: e.message });
    }).done();
});

router.post('/delete', user.requireLogIn, function(req, res, next) {
    EngineManager.get().getEngine(req.user.id).then(function(engine) {
        var id = req.body.id;
        return [engine, engine.apps.getApp(id)];
    }).spread(function(engine, app) {
        if (app === undefined) {
            res.status(404).render('error', { page_title: "ThingEngine - Error",
                                              message: "Not found." });
            return;
        }

        return engine.apps.removeApp(app);
    }).then(function() {
        appsList(req, res, next, "Application successfully deleted");
    }).catch(function(e) {
        res.status(400).render('error', { page_title: "ThingEngine - Error",
                                          message: e.message });
    }).done();
});

router.get('/:id/show', user.redirectLogIn, function(req, res, next) {
    EngineManager.get().getEngine(req.user.id).then(function(engine) {
        return engine.apps.getApp(req.params.id);
    }).then(function(app) {
        if (app === undefined) {
            res.status(404).render('error', { page_title: "ThingEngine - Error",
                                              message: "Not found." });
            return;
        }

        return Q.all([app.name, app.description, app.code, app.state])
            .spread(function(name, description, code, state) {
                return res.render('show_app', { page_title: "ThingEngine App",
                                                name: name,
                                                description: description || '',
                                                csrfToken: req.csrfToken(),
                                                code: code,
                                                params: JSON.stringify(state) });
            });
    }).catch(function(e) {
        res.status(400).render('error', { page_title: "ThingEngine - Error",
                                          message: e.message });
    }).done();
});

router.post('/:id/update', user.requireLogIn, function(req, res, next) {
    EngineManager.get().getEngine(req.user.id).then(function(engine) {
        return Q.all([engine, engine.apps.getApp(req.params.id), engine.devices.schemas])
    }).spread(function(engine, app, schemaRetriever) {
        if (app === undefined) {
            res.status(404).render('error', { page_title: "ThingEngine - Error",
                                              message: "Not found." });
            return;
        }

        return Q.all([app.name, app.description, app.currentTier])
            .spread(function(name, description, currentTier) {
                var code = req.body.code;
                var state;
                return Q.try(function() {
                    // sanity check the app
                    var compiler = new AppCompiler();
                    compiler.setSchemaRetriever(schemaRetriever);
                    return compiler.compileCode(code);
                }).then(function() {
                    state = JSON.parse(req.body.params);
                    return engine.apps.loadOneApp(code, state, req.params.id, currentTier, true);
                }).then(function() {
                    appsList(req, res, next, "Application successfully updated");
                }).catch(function(e) {
                    res.render('show_app', { page_title: 'ThingEngine App',
                                             name: name,
                                             description: description || '',
                                             csrfToken: req.csrfToken(),
                                             error: e.message,
                                             code: code,
                                             params: req.body.params });
                });
            });
    }).catch(function(e) {
        res.status(400).render('error', { page_title: "ThingEngine - Error",
                                          message: e.message });
    }).done();
});

module.exports = router;
