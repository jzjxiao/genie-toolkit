// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Genie
//
// Copyright 2018-2019 The Board of Trustees of the Leland Stanford Junior University, National Taiwan University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>, Johnny Hsu <johnny.chhsu01@gmail.com>
//
// See COPYING for details
"use strict";

const ARGUMENT_NAME_OVERRIDES = {};

const IGNORABLE_TOKENS = {
    'sportradar': ['fc', 'ac', 'us', 'if', 'as', 'rc', 'rb', 'il', 'fk', 'cd', 'cf'],
    'imgflip:meme_id': ['the'],
    'tt:currency_code': ['us'],
    'tt:stock_id': ['l.p.', 's.a.', 'plc', 'n.v', 's.a.b', 'c.v.'],
    'org:freedesktop:app_id': ['gnome']
};

const ABBREVIATIONS = [
    ['公司', '有限公司', '股份有限公司'],
    ['高鐵', '高速鐵路'],
    ['網路', '網際網路'],
    ['&', '和'],
];
const PROCESSED_ABBREVIATIONS = {};
for (let abbr of ABBREVIATIONS) {
    for (let variant of abbr)
        PROCESSED_ABBREVIATIONS[variant] = abbr;

}

function detokenize(buffer, prevtoken, token) {
    // join without space
    return buffer + token;
}

const NO_IDEA = [
    '不知道', '不懂', '不曉得', '不了解',
    '不了', '看不懂', '不清楚'
];

const PPDB_BLACKLIST = new Set([]);

// Check if a pair of word, paraphrase from PPDB should be considered a candidate
// for augmentation or not
function isValidParaphrasePair(word, paraphrase) {
    if (PPDB_BLACKLIST.has(word))
        return false;
    // TODO
    return true;
}

module.exports = {
    detokenize,

    ARGUMENT_NAME_OVERRIDES,

    IGNORABLE_TOKENS,
    ABBREVIATIONS: PROCESSED_ABBREVIATIONS,

    NO_IDEA,

    isValidParaphrasePair
};