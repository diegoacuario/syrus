
var jpro = {
    url: "https://pegasus1.pegasusgateway.com/jproxy/",
    //url : "https://pegasus1.pegasusgateway.com/dajaxice/src.apps.reversegeo.resolve/",

    debug: false,
    debug_div: null,
    version: '0.0.2',
    log: function (msg, obj)
    {
        if (this.debug == true)
        {

            var m = new Date() + " " + msg;
            console.log(m, obj)
            if (jpro.debug_div != null)
                document.getElementById(jpro.debug_div).innerHTML += "<br>" + m;

        }
    },
    init: function (appid, onready, onauth)
    {
        this.state = jpro.C.init;
        this.stack = [];
        this.lock_stack = [];
        this.sid = 0;

        this.appid = appid
        this.token = null;

        this.auth_req_id = 0;

        this.smtimer = null;
        this.pstimer = null;
        this.onready = onready;
        this.onauth = onauth;

        try {
            jpro.BrowserTimeZoneName = jstz.determine().name();
        } catch (e) {
            jpro.BrowserTimeZoneName = '';
            console.error(e);
        }
        if (jpro.onready != undefined)
            jpro.onready();

    },
    creds: {
        _data: {},
        set: function (uname, aord, storeit)
        {
            if (storeit == null)
                storeit = true;

            if (uname == null || aord == null)
                throw jpro.RETS.INVALID_PARAMETERS;

            if (uname.length < 1 || aord.length < 1)
                throw jpro.RETS.INVALID_PARAMETERS;


            if (jpro.state == null)
                throw jpro.RETS.NOT_READY;

            /*
             try
             {
             if (jpro.credentials.uname == uname)
             {
             if (jpro.credentials.aord == aord)
             {
             return false; //nothing's changed
             }
             
             }
             }
             catch(e){}*/

            jpro.token = null;
            jpro.creds._data.storeit = storeit;
            jpro.creds._data.uname = uname;
            jpro.creds._data.aord = aord;

            jpro.log("setting credentials")

            jpro.state = jpro.C.gettoken;
            jpro.run_sm(10);
            return true;
        },
        tryStoredSession: function ()
        {
            return false;
            if (jpro.state == null)
                throw jpro.RETS.NOT_READY;



            if (jpro.appid == null)
                throw jpro.RETS.NOT_READY;
            try
            {

                var item = jpro.appid + "_sess";
                var c = JSON.parse(window.localStorage.getItem(item));

                if (c == null)
                    return false;

                /*
                 try
                 {
                 jpro.creds.set(c.uname, c.aord, true);
                 }
                 catch(e)
                 {
                 jpro.creds._deleteStored();
                 return false;
                 }*/
                jpro.token = c['token']
                jpro.state = jpro.C.auth_req2_done;
                jpro.run_sm(10)


                return true;


            }
            catch (e) {
                console.error(e);
                return false
            }

        },
        logout: function ()
        {
            //jpro.creds._data.storeit = false;
            //jpro.creds._deleteStored();
            //logout
            jpro.mRequest('Auth._req', {'state': 'lo'}, jpro.cbs.on_authReq_done);
        },
        _deleteStored: function ()
        {
            try
            {
                var item = jpro.appid + "_sess";
                window.localStorage.removeItem(item)
            } catch (e) {
            }
        },
        _onLogin: function (status)
        {


            if (status == 'ok')
            {
                return;
                if (jpro.creds._data.storeit == true)
                {

                    try
                    {
                        var item = jpro.appid + "_sess";
                        window.localStorage.setItem(item, JSON.stringify({token: jpro.token}));
                    }
                    catch (e) {
                    }


                    return;
                }
                else
                {
                    //jpro.creds._deleteStored();

                }
            }
            if (status == 'ko')
            {
                jpro.creds._deleteStored();
            }
        }



    },
    run_pstack: function (t)
    {
        if (jpro.pstimer != null)
            clearTimeout(jpro.pstimer);

        jpro.pstimer = setTimeout(jpro.pStack, t);

    },
    pStack: function ()
    {

        if (jpro.stack.length == 0)
            return;

        //console.log("pstack")
        //todo: check completed calls
        //todo: check expired calls

        if (jpro.state != jpro.C.ready)//todo: if pending calls, and  state is 'init', move to "gettoken"
        {
            jpro.log("pstack pendings, waiting ready state");
            jpro.run_pstack(1000);
            return;
        }

        var somenew = false;
        jpro.lock_stack.push(true);
        var deletes = [];
        for (i in jpro.stack)
        {
            if (jpro.stack[i].state == jpro.C.stack_init)
            {
                somenew = true;

                //console.log("new call " + jpro.stack[i].m);
                var mid = jpro.mRequest(jpro.stack[i].m, jpro.stack[i].p, jpro.on_stack_call_done);
                jpro.stack[i].mid = mid;

                jpro.stack[i].state = jpro.C.stack_called;
            }
            if (jpro.stack[i].state == jpro.C.stack_delete)
            {
                deletes.push(i)
            }
        }
        jpro.lock_stack.pop();

        if (deletes.length > 0)
        {
            if (jpro.lock_stack.length == 0)
            {
                for (var j in deletes)
                    jpro.stack.splice(parseInt(deletes[j]), 1);
            }
        }


        if (somenew == true)
            jpro.run_pstack(10);
        else
            jpro.run_pstack(1000);
    },
    on_stack_call_done: function (status, data, t)
    {

        jpro.log(status, data);

        jpro.lock_stack.push(true);
        for (var i in jpro.stack)
        {
            if (jpro.stack[i].mid != data.id)
                continue

            var error = null;
            if (data['error'] != undefined)
            {
                if (data['error'] != null)
                {
                    error = data['error'];


                }
            }


            if (error != null || status != 'ok')
            {
                if (jpro._validateError(data) == true)
                {
                    jpro.stack[i].state = jpro.C.stack_init; //method call must be retried
                    jpro.lock_stack.pop(true);
                    return;
                }


                jpro.stack[i].c(false, error);
            }
            else
            {
                try
                {
                    jpro.stack[i].c(true, data['result']);
                } catch (e)
                {
                    jpro.stack[i].c(false, "missing response");
                }
            }

            jpro.stack[i].state = jpro.C.stack_delete;
            break;

        }
        jpro.lock_stack.pop(true);






    },
    _validateError: function (data)
    {
        try {
            errcode = data['error']['code']


            if (errcode == 102 || errcode == 100 || errcode == 103)
            {
                jpro.log("auth error logged out ", data);
                jpro.last_errcode = errcode;
                jpro.state = jpro.C.autherror;
                jpro.run_sm(100);
                return true;

            }
            if (errcode == 101)
            {
                jpro.log("auth tempoal error ", data);
                jpro.state = jpro.C.gettoken;
                jpro.run_sm(100);
                return true;
            }


            jpro.log("unknown error ", data);
            //jpro.state = jpro.C.reset;
            //jpro.run_sm(1000);
            return false

        } catch (e) {
        }
        return false;
    },
    run_sm: function (t)
    {
        if (this.smtimer != null)
            clearTimeout(this.smtimer);

        this.smtimer = setTimeout(jpro.sm, t);
    },
    cbs: {
        on_authReq_done: function (status, datain, ts)
        {
            //console.log(datain);

            var data = datain.result;
            jpro.log("authdone", datain)
            //todo: check auth flag
            var isvalid = false;
            if (status == 'ok')
            {
                try {

                    while (true)
                    {
                        if (data.auth_req_id != jpro.auth_req_id)
                            break;

                        if (data.state != jpro.state)
                            break

                        isvalid = true;
                        jpro.last_errcode = undefined;
                        break
                    }
                }
                catch (e) {
                    jpro.log(e)
                }
            }


            if (isvalid == false)
            {
                /*
                 try{
                 errcode = datain.error.code
                 if (errcode == 100 || errcode == 101 || errcode == 102)
                 {
                 jpro.log("auth error", errcode);
                 jpro.state = jpro.C.autherror;
                 jpro.run_sm(50);
                 return;
                 }
                 }catch(e){}
                 
                 jpro.log("invalid authReq response");
                 jpro.state = jpro.C.reset;
                 jpro.run_sm(3000);
                 return;*/

                if (jpro._validateError(datain) == true)
                    return
            }

            /*if (auth == false)
             {
             jpro.log("auth error");
             jpro.log(data);
             jpro.state = 'autherror';
             jpro.run_sm(3000);
             return;
             }*/

            if (data.state == jpro.C.auth_req1)
            {
                jpro.challenge = data.challenge;
                jpro.challenge_alg = data.challenge_alg;
                jpro.state = jpro.C.auth_req1_done;
            }

            if (data.state == jpro.C.auth_req2)
            {
                jpro.token = data.token;
                jpro.state = jpro.C.auth_req2_done;
            }
            jpro.run_sm(10);
            return;
        },
        on_inspect_done: function (status, resp, ts)
        {

            var isvalid = false;
            if (status == 'ok')
            {
                try {

                    while (true)
                    {
                        if (jpro.state != jpro.C.inspect_update)
                            break;

                        if (resp['result'] == undefined)
                            break


                        isvalid = true;
                        break
                    }
                }
                catch (e) {
                    jpro.log(e)
                }
            }

            if (resp['result'] == undefined)
            {
                isvalid == false
            }

            if (isvalid == false)
            {
                //jpro.log("invalid inspect response");

                //return;

                if (jpro._validateError(resp) == true)
                    return
            }

            jpro.api = new Object();
            jpro.api_desc = new Object();

            var data = resp['result'];
            for (var i in data)
            {

                var cname = data[i][0];
                jpro.api[cname] = new Object();
                jpro.api_desc[cname] = new Object();

                for (var j in data[i][1])
                {
                    var mname = data[i][1][j]['name'];


                    f = jpro.createApiMethod(cname, mname);
                    jpro.api[cname][mname] = f;
                    jpro.api_desc[cname][mname] = data[i][1][j]['description'];

                    /*jpro.api[cname][mname] = function (params,cb,timeout)
                     {
                     
                     jpro.call(cname+"."+mname, params, cb, timeout);
                     }*/

                }
            }


            jpro.state = jpro.C.inspect_update_done;
            jpro.run_sm(10);


        }
        ,
        on_ready: function ()
        {
            jpro.log(" READY ");


        }
        ,
        on_auth: function (state, data, errcode)
        {
            jpro.log(" AUTH RESULT " + state);
            jpro.creds._onLogin(state);

            if (jpro.onauth != undefined)
                jpro.onauth(state, data, errcode);

        }


    },
    createApiMethod: function (cl, me)
    {
        var cname = cl;
        var mname = me;
        return function (params, cb, timeout)
        {

            return jpro.call(cname + "." + mname, params, cb, timeout);
        }
    },
    sm: function ()
    {

        jpro.log("sm [" + jpro.state + "]");
        jpro.run_pstack(10);


        if (jpro.state == jpro.C.init)
        {
            return;
        }

        if (jpro.state == jpro.C.tokenset)
        {
            jpro.state = jpro.C.inspect_update
            jpro.mRequest("Methods.getSimpleList", {}, jpro.cbs.on_inspect_done)
            return;
        }

        if (jpro.state == jpro.C.inspect_update_done)
        {
            jpro.state = jpro.C.ready
            jpro.run_sm(10);
            return;
        }

        if (jpro.state == jpro.C.ready)
        {
            jpro.cbs.on_ready();
            return;
        }

        if (jpro.state == jpro.C.reset)
        {
            jpro.token = null;
            return;
        }

        if (jpro.state == jpro.C.autherror)
        {
            jpro.token = null;
            jpro.cbs.on_auth('ko', "auth error", jpro.last_errcode);
            return;
        }

        if (jpro.state == jpro.C.gettoken)
        {

            jpro.cbs.on_auth('processing', "processing");
            var remoteset = true;
            try
            {
                if (jpro.url == undefined)
                    remoteset = false;
            }
            catch (e) {
                remoteset = false;
            }

            if (remoteset == false)
            {
                jpro.log("no url  set");
                console.warn("no url set");
                jpro.run_sm(3000);
                return;
            }


            var credsset = true;
            try
            {
                if (jpro.appid == undefined)
                    credsset = false;

                if (jpro.creds._data.uname == undefined)
                    credsset = false;

                if (jpro.creds._data.aord == undefined)
                    credsset = false;
            }

            catch (e) {
                credsset = false;
            }

            if (credsset == false)
            {
                jpro.cbs.on_auth('ko', "no credentials set");
                jpro.log("no credentials set");
                console.warn("no credentials set");
                jpro.run_sm(3000);
                return;
            }

            //ask for token
            jpro.state = jpro.C.auth_req1; //token asked, waiting challenge 
            jpro.auth_req_id++;
            jpro.timeout = new Date()
            var params = {
                state: jpro.state,
                auth_req_id: jpro.auth_req_id,
                uname: jpro.creds._data.uname
            }
            jpro.mRequest('Auth._req', params, jpro.cbs.on_authReq_done);
            jpro.run_sm(10);
            return;
        }

        if (jpro.state == jpro.C.auth_req1)
        {
            jpro.log("waiting challenge...")
            if (new Date() - jpro.timeout > 10000)
            {
                jpro.log("timeout, requesting again...")
                console.warn("timeout...");

                jpro.state = 'gettoken';
                jpro.run_sm(10);
                return;

            }
            jpro.run_sm(2000);
            return;
        }

        if (jpro.state == jpro.C.auth_req1_done)
        {
            //got challenge, send response
            jpro.state = jpro.C.auth_req2 //
            jpro.auth_req_id++;
            jpro.timeout = new Date()

            var res = SHA1(jpro.challenge + "." + jpro.creds._data.uname + ";" + SHA1(jpro.challenge.substr(0, 5) + jpro.creds._data.aord));

            var params = {
                state: jpro.state,
                auth_req_id: jpro.auth_req_id,
                msg: res,
                snt: jpro.challenge
            }
            delete(jpro.creds._data.aord);
            delete(jpro.challenge);
            jpro.mRequest('Auth._req', params, jpro.cbs.on_authReq_done);

            jpro.run_sm(10);
            return;

        }

        if (jpro.state == jpro.C.auth_req2)
        {
            jpro.log("waiting token...")
            if (new Date() - jpro.timeout > 20000)
            {
                jpro.log("timeout, requesting again...")
                console.warn("timeout...");

                jpro.state = jpro.C.gettoken;
                jpro.run_sm(50);
                return;

            }
            jpro.run_sm(2000);
            return;
        }

        if (jpro.state == jpro.C.auth_req2_done)
        {
            //setTimeout(jpro.sm, 10);

            jpro.state = jpro.C.tokenset
            //this.state = 'tokenerror'//received token or err.
            jpro.log("token set");
            jpro.cbs.on_auth('ok', jpro.creds._data.uname);
            jpro.run_sm(10);

        }



    },
    callid: 0,
    call: function (method, params, cb, tout)
    {
        if (jpro.state == undefined)
            throw jpro.RETS.NOT_READY

        if (jpro.state == null)
            throw jpro.RETS.NOT_READY


        if (jpro.state == jpro.C.autherror)
            throw jpro.RETS.AUTH_ERROR

        try
        {
            if (jpro.creds._data.uname == undefined)
                throw jpro.RETS.NO_CREDENTIALS;

            //if (jpro.creds._data.aord == undefined)
            //throw jpro.RETS.NO_CREDENTIALS;
        }

        catch (e) {
            throw jpro.RETS.NO_CREDENTIALS
        }

        if (jpro.stack.length > jpro.C.MAX_STACK_LENGTH)
            throw jpro.RETS.MAX_STACK_LENGTH_REACHED;

        if (tout > 300)
            tout = 300

        if (tout < 10)
            tout = 10

        jpro.lock_stack.push(true);
        jpro.stack.push({
            'id': jpro.callid,
            'm': method,
            'p': params,
            'c': cb,
            'to': tout,
            'ti': new Date(),
            'state': jpro.C.stack_init

        });
        jpro.lock_stack.pop();
        jpro.callid++;
        //setTimeout(jpro.sm, 1);
        jpro.run_sm(1);
        jpro.run_pstack(1);
        return jpro.callid;
    },
    mid: 0,
    mRequest: function (method, params, cb)
    {
        jpro.mid++;


        var appid = null;
        try
        {
            var appid = jpro.appid;
        } catch (e) {
        }

        var token = null;
        try
        {
            var token = jpro.token;
        } catch (e) {
        }


        var meta = {
            version: jpro.version,
            token: token,
            appid: appid,
            utz: jpro.BrowserTimeZoneName
        }


        var obj = {method: method, params: params, id: jpro.mid, meta: meta};
        jpro.req.doRequest(JSON.stringify(obj), jpro.url, cb);

        return jpro.mid;
    },
    RETS: {
        NOT_READY: "Not ready, call init() and set credentials first",
        NO_CREDENTIALS: "No user credentials set",
        MAX_STACK_LENGTH_REACHED: "Too many pending requests, wait for some to end.",
        AUTH_ERROR: "Auth error, re-set credentials",
        INVALID_PARAMETERS: "Invalid parameter"

    },
    C: {
        MAX_STACK_LENGTH: 50,
        auth_req1: 'r1',
        auth_req2: 'r2',
        auth_req1_done: 'r1d',
        auth_req2_done: 'r2d',
        tokenset: 'tks',
        inspect_update: 'insp',
        inspect_update_done: 'insp_done',
        autherror: 'aerr',
        reset: 'rst',
        ready: 'rdy',
        gettoken: 'gtk',
        init: 'i',
        stack_init: 'si',
        stack_called: 'sc',
        stack_delete: 'sd',
    },
    req: {
        createRequest: function (url)
        {
            var xhr = new XMLHttpRequest();

            if ("withCredentials" in xhr)
            {
                //xhr.withCredentials = true;
                xhr.open('POST', url, true);
            }
            else if (typeof XDomainRequest != "undefined")
            {
                xhr = new XDomainRequest();
                xhr.open('POST', url);
            }
            else
            {
                xhr = null;
            }

            return xhr;
        },
        doRequest: function (params, url, cb)
        {

            var xhr = jpro.req.createRequest(url);

            if (!xhr)
            {
                console.error('unsupported JS engine');
                jpro.log('unsupported JS engine');
                return false;
            }
            jpro.log('do request done');
            tstamp = new Date();

            // Response handlers.
            xhr.onload = function ()
            {
                if (xhr.status == 200)
                {

                    try
                    {
                        var data = JSON.parse(xhr.responseText);
                        if (data['error'] == null)
                            cb('ok', data, tstamp);
                        else
                            cb('method_error', data, tstamp);
                    }
                    catch (e)
                    {
                        jpro.log("request response exception: " + e)
                        cb('exception', xhr, tstamp);
                    }

                }
                else
                    cb('remote server error http code ' + xhr.status, xhr, tstamp);
                /*
                 var text = xhr.responseText;
                 console.log('Response from CORS request to ' + url + ': ' + text);*/
            };

            xhr.onerror = function ()
            {

                jpro.log("error making the request");
                //console.error('Woops, there was an error making the request.', this);
                cb('comm. error', xhr, tstamp);
            };

            //this.credentials.devid = devid;

            //    this.token = null;
            var appid = null;
            try
            {
                var appid = jpro.appid;
            } catch (e) {
            }

            var token = null;
            try
            {
                var token = jpro.token;
            } catch (e) {
            }

            /*
             if (token != null)
             xhr.setRequestHeader("JProxy-token", token);
             
             if (devid != null)
             xhr.setRequestHeader("JProxy-devid", devid);*/



            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            xhr.send(params);
            jpro.log('do request sent');

            return true;
        }

    }



}



function SHA1(msg) {

    function rotate_left(n, s) {
        var t4 = (n << s) | (n >>> (32 - s));
        return t4;
    }
    ;

    function lsb_hex(val) {
        var str = "";
        var i;
        var vh;
        var vl;

        for (i = 0; i <= 6; i += 2) {
            vh = (val >>> (i * 4 + 4)) & 0x0f;
            vl = (val >>> (i * 4)) & 0x0f;
            str += vh.toString(16) + vl.toString(16);
        }
        return str;
    }
    ;

    function cvt_hex(val) {
        var str = "";
        var i;
        var v;

        for (i = 7; i >= 0; i--) {
            v = (val >>> (i * 4)) & 0x0f;
            str += v.toString(16);
        }
        return str;
    }
    ;


    function Utf8Encode(string) {
        string = string.replace(/\r\n/g, "\n");
        var utftext = "";

        for (var n = 0; n < string.length; n++) {

            var c = string.charCodeAt(n);

            if (c < 128) {
                utftext += String.fromCharCode(c);
            }
            else if ((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            }
            else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }

        }

        return utftext;
    }
    ;

    var blockstart;
    var i, j;
    var W = new Array(80);
    var H0 = 0x67452301;
    var H1 = 0xEFCDAB89;
    var H2 = 0x98BADCFE;
    var H3 = 0x10325476;
    var H4 = 0xC3D2E1F0;
    var A, B, C, D, E;
    var temp;

    msg = Utf8Encode(msg);

    var msg_len = msg.length;

    var word_array = new Array();
    for (i = 0; i < msg_len - 3; i += 4) {
        j = msg.charCodeAt(i) << 24 | msg.charCodeAt(i + 1) << 16 |
                msg.charCodeAt(i + 2) << 8 | msg.charCodeAt(i + 3);
        word_array.push(j);
    }

    switch (msg_len % 4) {
        case 0:
            i = 0x080000000;
            break;
        case 1:
            i = msg.charCodeAt(msg_len - 1) << 24 | 0x0800000;
            break;

        case 2:
            i = msg.charCodeAt(msg_len - 2) << 24 | msg.charCodeAt(msg_len - 1) << 16 | 0x08000;
            break;

        case 3:
            i = msg.charCodeAt(msg_len - 3) << 24 | msg.charCodeAt(msg_len - 2) << 16 | msg.charCodeAt(msg_len - 1) << 8 | 0x80;
            break;
    }

    word_array.push(i);

    while ((word_array.length % 16) != 14)
        word_array.push(0);

    word_array.push(msg_len >>> 29);
    word_array.push((msg_len << 3) & 0x0ffffffff);


    for (blockstart = 0; blockstart < word_array.length; blockstart += 16) {

        for (i = 0; i < 16; i++)
            W[i] = word_array[blockstart + i];
        for (i = 16; i <= 79; i++)
            W[i] = rotate_left(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);

        A = H0;
        B = H1;
        C = H2;
        D = H3;
        E = H4;

        for (i = 0; i <= 19; i++) {
            temp = (rotate_left(A, 5) + ((B & C) | (~B & D)) + E + W[i] + 0x5A827999) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B, 30);
            B = A;
            A = temp;
        }

        for (i = 20; i <= 39; i++) {
            temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B, 30);
            B = A;
            A = temp;
        }

        for (i = 40; i <= 59; i++) {
            temp = (rotate_left(A, 5) + ((B & C) | (B & D) | (C & D)) + E + W[i] + 0x8F1BBCDC) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B, 30);
            B = A;
            A = temp;
        }

        for (i = 60; i <= 79; i++) {
            temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B, 30);
            B = A;
            A = temp;
        }

        H0 = (H0 + A) & 0x0ffffffff;
        H1 = (H1 + B) & 0x0ffffffff;
        H2 = (H2 + C) & 0x0ffffffff;
        H3 = (H3 + D) & 0x0ffffffff;
        H4 = (H4 + E) & 0x0ffffffff;

    }

    var temp = cvt_hex(H0) + cvt_hex(H1) + cvt_hex(H2) + cvt_hex(H3) + cvt_hex(H4);

    return temp.toLowerCase();

}


/**
 * This script gives you the zone info key representing your device's time zone setting.
 *
 * @name jsTimezoneDetect
 * @version 1.0.5
 * @author Jon Nylander
 * @license MIT License - http://www.opensource.org/licenses/mit-license.php
 *
 * For usage and examples, visit:
 * http://pellepim.bitbucket.org/jstz/
 *
 * Copyright (c) Jon Nylander
 */

/*jslint undef: true */
/*global console, exports*/

(function (root) {
    /**
     * Namespace to hold all the code for timezone detection.
     */
    var jstz = (function () {
        'use strict';
        var HEMISPHERE_SOUTH = 's',
                cur_key = '',
                /**
                 * Gets the offset in minutes from UTC for a certain date.
                 * @param {Date} date
                 * @returns {Number}
                 */
                get_date_offset = function (date) {
                    var offset = -date.getTimezoneOffset();
                    return (offset !== null ? offset : 0);
                },
                get_date = function (year, month, date) {
                    var d = new Date();
                    if (year !== undefined) {
                        d.setFullYear(year);
                    }
                    d.setMonth(month);
                    d.setDate(date);
                    return d;
                },
                get_january_offset = function (year) {
                    return get_date_offset(get_date(year, 0, 2));
                },
                get_june_offset = function (year) {
                    return get_date_offset(get_date(year, 5, 2));
                },
                /**
                 * Private method.
                 * Checks whether a given date is in daylight saving time.
                 * If the date supplied is after august, we assume that we're checking
                 * for southern hemisphere DST.
                 * @param {Date} date
                 * @returns {Boolean}
                 */
                date_is_dst = function (date) {
                    var is_southern = date.getMonth() > 7,
                            base_offset = is_southern ? get_june_offset(date.getFullYear()) :
                            get_january_offset(date.getFullYear()),
                            date_offset = get_date_offset(date),
                            is_west = base_offset < 0,
                            dst_offset = base_offset - date_offset;

                    if (!is_west && !is_southern) {
                        return dst_offset < 0;
                    }

                    return dst_offset !== 0;
                },
                /**
                 * This function does some basic calculations to create information about
                 * the user's timezone. It uses REFERENCE_YEAR as a solid year for which
                 * the script has been tested rather than depend on the year set by the
                 * client device.
                 *
                 * Returns a key that can be used to do lookups in jstz.olson.timezones.
                 * eg: "720,1,2". 
                 *
                 * @returns {String}
                 */

                lookup_key = function () {
                    var january_offset = get_january_offset(),
                            june_offset = get_june_offset(),
                            diff = january_offset - june_offset;

                    if (diff < 0) {
                        return january_offset + ",1";
                    } else if (diff > 0) {
                        return june_offset + ",1," + HEMISPHERE_SOUTH;
                    }

                    return january_offset + ",0";
                },
                /**
                 * Uses get_timezone_info() to formulate a key to use in the olson.timezones dictionary.
                 *
                 * Returns a primitive object on the format:
                 * {'timezone': TimeZone, 'key' : 'the key used to find the TimeZone object'}
                 *
                 * @returns Object
                 */
                determine = function () {
                    var key = lookup_key();
                    jstz.cur_key = key;
                    return new jstz.TimeZone(jstz.olson.timezones[key]);
                },
                /**
                 * This object contains information on when daylight savings starts for
                 * different timezones.
                 *
                 * The list is short for a reason. Often we do not have to be very specific
                 * to single out the correct timezone. But when we do, this list comes in
                 * handy.
                 *
                 * Each value is a date denoting when daylight savings starts for that timezone.
                 */
                dst_start_for = function (tz_name) {

                    var ru_pre_dst_change = new Date(2010, 6, 15, 1, 0, 0, 0), // In 2010 Russia had DST, this allows us to detect Russia :)
                            dst_starts = {
                                'America/Denver': new Date(2011, 2, 13, 3, 0, 0, 0),
                                'America/Mazatlan': new Date(2011, 3, 3, 3, 0, 0, 0),
                                'America/Chicago': new Date(2011, 2, 13, 3, 0, 0, 0),
                                'America/Mexico_City': new Date(2011, 3, 3, 3, 0, 0, 0),
                                'America/Asuncion': new Date(2012, 9, 7, 3, 0, 0, 0),
                                'America/Santiago': new Date(2012, 9, 3, 3, 0, 0, 0),
                                'America/Campo_Grande': new Date(2012, 9, 21, 5, 0, 0, 0),
                                'America/Montevideo': new Date(2011, 9, 2, 3, 0, 0, 0),
                                'America/Sao_Paulo': new Date(2011, 9, 16, 5, 0, 0, 0),
                                'America/Los_Angeles': new Date(2011, 2, 13, 8, 0, 0, 0),
                                'America/Santa_Isabel': new Date(2011, 3, 5, 8, 0, 0, 0),
                                'America/Havana': new Date(2012, 2, 10, 2, 0, 0, 0),
                                'America/New_York': new Date(2012, 2, 10, 7, 0, 0, 0),
                                'Europe/Helsinki': new Date(2013, 2, 31, 5, 0, 0, 0),
                                'Pacific/Auckland': new Date(2011, 8, 26, 7, 0, 0, 0),
                                'America/Halifax': new Date(2011, 2, 13, 6, 0, 0, 0),
                                'America/Goose_Bay': new Date(2011, 2, 13, 2, 1, 0, 0),
                                'America/Miquelon': new Date(2011, 2, 13, 5, 0, 0, 0),
                                'America/Godthab': new Date(2011, 2, 27, 1, 0, 0, 0),
                                'Europe/Moscow': ru_pre_dst_change,
                                'Asia/Amman': new Date(2013, 2, 29, 1, 0, 0, 0),
                                'Asia/Beirut': new Date(2013, 2, 31, 2, 0, 0, 0),
                                'Asia/Damascus': new Date(2013, 3, 6, 2, 0, 0, 0),
                                'Asia/Jerusalem': new Date(2013, 2, 29, 5, 0, 0, 0),
                                'Asia/Yekaterinburg': ru_pre_dst_change,
                                'Asia/Omsk': ru_pre_dst_change,
                                'Asia/Krasnoyarsk': ru_pre_dst_change,
                                'Asia/Irkutsk': ru_pre_dst_change,
                                'Asia/Yakutsk': ru_pre_dst_change,
                                'Asia/Vladivostok': ru_pre_dst_change,
                                'Asia/Baku': new Date(2013, 2, 31, 4, 0, 0),
                                'Asia/Yerevan': new Date(2013, 2, 31, 3, 0, 0),
                                'Asia/Kamchatka': ru_pre_dst_change,
                                'Asia/Gaza': new Date(2010, 2, 27, 4, 0, 0),
                                'Africa/Cairo': new Date(2010, 4, 1, 3, 0, 0),
                                'Europe/Minsk': ru_pre_dst_change,
                                'Pacific/Apia': new Date(2010, 10, 1, 1, 0, 0, 0),
                                'Pacific/Fiji': new Date(2010, 11, 1, 0, 0, 0),
                                'Australia/Perth': new Date(2008, 10, 1, 1, 0, 0, 0)
                            };

                    return dst_starts[tz_name];
                };

        return {
            determine: determine,
            date_is_dst: date_is_dst,
            dst_start_for: dst_start_for
        };
    }());

    /**
     * Simple object to perform ambiguity check and to return name of time zone.
     */
    jstz.TimeZone = function (tz_name) {
        'use strict';
        /**
         * The keys in this object are timezones that we know may be ambiguous after
         * a preliminary scan through the olson_tz object.
         *
         * The array of timezones to compare must be in the order that daylight savings
         * starts for the regions.
         */
        var AMBIGUITIES = {
            'America/Denver': ['America/Denver', 'America/Mazatlan'],
            'America/Chicago': ['America/Chicago', 'America/Mexico_City'],
            'America/Santiago': ['America/Santiago', 'America/Asuncion', 'America/Campo_Grande'],
            'America/Montevideo': ['America/Montevideo', 'America/Sao_Paulo'],
            'Asia/Beirut': ['Asia/Amman', 'Asia/Jerusalem', 'Asia/Beirut', 'Europe/Helsinki', 'Asia/Damascus'],
            'Pacific/Auckland': ['Pacific/Auckland', 'Pacific/Fiji'],
            'America/Los_Angeles': ['America/Los_Angeles', 'America/Santa_Isabel'],
            'America/New_York': ['America/Havana', 'America/New_York'],
            'America/Halifax': ['America/Goose_Bay', 'America/Halifax'],
            'America/Godthab': ['America/Miquelon', 'America/Godthab'],
            'Asia/Dubai': ['Europe/Moscow'],
            'Asia/Dhaka': ['Asia/Yekaterinburg'],
            'Asia/Jakarta': ['Asia/Omsk'],
            'Asia/Shanghai': ['Asia/Krasnoyarsk', 'Australia/Perth'],
            'Asia/Tokyo': ['Asia/Irkutsk'],
            'Australia/Brisbane': ['Asia/Yakutsk'],
            'Pacific/Noumea': ['Asia/Vladivostok'],
            'Pacific/Tarawa': ['Asia/Kamchatka', 'Pacific/Fiji'],
            'Pacific/Tongatapu': ['Pacific/Apia'],
            'Asia/Baghdad': ['Europe/Minsk'],
            'Asia/Baku': ['Asia/Yerevan', 'Asia/Baku'],
            'Africa/Johannesburg': ['Asia/Gaza', 'Africa/Cairo']
        },
        timezone_name = tz_name,
                /**
                 * Checks if a timezone has possible ambiguities. I.e timezones that are similar.
                 *
                 * For example, if the preliminary scan determines that we're in America/Denver.
                 * We double check here that we're really there and not in America/Mazatlan.
                 *
                 * This is done by checking known dates for when daylight savings start for different
                 * timezones during 2010 and 2011.
                 */
                ambiguity_check = function () {
                    var ambiguity_list = AMBIGUITIES[timezone_name],
                            length = ambiguity_list.length,
                            i = 0,
                            tz = ambiguity_list[0];

                    for (; i < length; i += 1) {
                        tz = ambiguity_list[i];

                        if (jstz.date_is_dst(jstz.dst_start_for(tz))) {
                            timezone_name = tz;
                            return;
                        }
                    }
                },
                /**
                 * Checks if it is possible that the timezone is ambiguous.
                 */
                is_ambiguous = function () {
                    return typeof (AMBIGUITIES[timezone_name]) !== 'undefined';
                };

        if (is_ambiguous()) {
            ambiguity_check();
        }

        return {
            name: function () {
                return timezone_name;
            },
            offset_key: function () {
                return jstz.cur_key;
            }
        };
    };

    jstz.olson = {};

    /*
     * The keys in this dictionary are comma separated as such:
     *
     * First the offset compared to UTC time in minutes.
     *
     * Then a flag which is 0 if the timezone does not take daylight savings into account and 1 if it
     * does.
     *
     * Thirdly an optional 's' signifies that the timezone is in the southern hemisphere,
     * only interesting for timezones with DST.
     *
     * The mapped arrays is used for constructing the jstz.TimeZone object from within
     * jstz.determine_timezone();
     */
    jstz.olson.timezones = {
        '-720,0': 'Pacific/Majuro',
        '-660,0': 'Pacific/Pago_Pago',
        '-600,1': 'America/Adak',
        '-600,0': 'Pacific/Honolulu',
        '-570,0': 'Pacific/Marquesas',
        '-540,0': 'Pacific/Gambier',
        '-540,1': 'America/Anchorage',
        '-480,1': 'America/Los_Angeles',
        '-480,0': 'Pacific/Pitcairn',
        '-420,0': 'America/Phoenix',
        '-420,1': 'America/Denver',
        '-360,0': 'America/Guatemala',
        '-360,1': 'America/Chicago',
        '-360,1,s': 'Pacific/Easter',
        '-300,0': 'America/Bogota',
        '-300,1': 'America/New_York',
        '-270,0': 'America/Caracas',
        '-240,1': 'America/Halifax',
        '-240,0': 'America/Santo_Domingo',
        '-240,1,s': 'America/Santiago',
        '-210,1': 'America/St_Johns',
        '-180,1': 'America/Godthab',
        '-180,0': 'America/Argentina/Buenos_Aires',
        '-180,1,s': 'America/Montevideo',
        '-120,0': 'America/Noronha',
        '-120,1': 'America/Noronha',
        '-60,1': 'Atlantic/Azores',
        '-60,0': 'Atlantic/Cape_Verde',
        '0,0': 'UTC',
        '0,1': 'Europe/London',
        '60,1': 'Europe/Berlin',
        '60,0': 'Africa/Lagos',
        '60,1,s': 'Africa/Windhoek',
        '120,1': 'Asia/Beirut',
        '120,0': 'Africa/Johannesburg',
        '180,0': 'Asia/Baghdad',
        '180,1': 'Europe/Moscow',
        '210,1': 'Asia/Tehran',
        '240,0': 'Asia/Dubai',
        '240,1': 'Asia/Baku',
        '270,0': 'Asia/Kabul',
        '300,1': 'Asia/Yekaterinburg',
        '300,0': 'Asia/Karachi',
        '330,0': 'Asia/Kolkata',
        '345,0': 'Asia/Kathmandu',
        '360,0': 'Asia/Dhaka',
        '360,1': 'Asia/Omsk',
        '390,0': 'Asia/Rangoon',
        '420,1': 'Asia/Krasnoyarsk',
        '420,0': 'Asia/Jakarta',
        '480,0': 'Asia/Shanghai',
        '480,1': 'Asia/Irkutsk',
        '525,0': 'Australia/Eucla',
        '525,1,s': 'Australia/Eucla',
        '540,1': 'Asia/Yakutsk',
        '540,0': 'Asia/Tokyo',
        '570,0': 'Australia/Darwin',
        '570,1,s': 'Australia/Adelaide',
        '600,0': 'Australia/Brisbane',
        '600,1': 'Asia/Vladivostok',
        '600,1,s': 'Australia/Sydney',
        '630,1,s': 'Australia/Lord_Howe',
        '660,1': 'Asia/Kamchatka',
        '660,0': 'Pacific/Noumea',
        '690,0': 'Pacific/Norfolk',
        '720,1,s': 'Pacific/Auckland',
        '720,0': 'Pacific/Tarawa',
        '765,1,s': 'Pacific/Chatham',
        '780,0': 'Pacific/Tongatapu',
        '780,1,s': 'Pacific/Apia',
        '840,0': 'Pacific/Kiritimati'
    };

    if (typeof exports !== 'undefined') {
        exports.jstz = jstz;
    } else {
        root.jstz = jstz;
    }
})(this);











