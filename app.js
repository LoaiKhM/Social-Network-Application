const express = require('express');
const session = require('express-session');
const fileupload = require('express-fileupload');
const { MongoClient, ObjectId } = require('mongodb'); // Import ObjectId to query by _id
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const e = require('express');
const { log } = require('console');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

require('dotenv').config();
app.use(fileupload());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));

const port = 3000;
const sessionMid = session({
    secret: "SOCIALMEDIAAPPLICATIONMADEBYLOAIMAKLAD",
    saveUninitialized: true,
    resave: false,
    cookie: { secure: false }
})
app.use(sessionMid);
io.use((socket, next) => {
    sessionMid(socket.request, socket.request.res || {}, next)
})



async function main() {
    
    const url = process.env.DB_URL
    const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true })
    try {        
        await client.connect()

        console.log('connected to db')
        const database = client.db('SMDatabase')

        io.on('connection', async (socket) => {
            const session = socket.request.session
            
            const msgrUsers = database.collection('msgrUsers')
            const checkext = await msgrUsers.findOne({ userid: session.userid })
            if (checkext && checkext.socketid !== socket.id) {
                await msgrUsers.findOneAndUpdate({ userid: session.userid}, { $set: { socketid: socket.id } })
                
            }

            if (!checkext) {
                

                await msgrUsers.insertOne({ userid: session.userid, socketid: socket.id })

            }

            // استقبال الحدث من العميل
            socket.on('message-send', async (data) => {

                const { getID } = data
                let socketidNow = await msgrUsers.findOne({ userid: getID })
                let socketidNowU2 = await msgrUsers.findOne({ userid: session.userid })

                socketidNowU2 = socketidNowU2.socketid
                io.to(socketidNowU2).emit('message-send', data)
                socketidNow = socketidNow.socketid
                io.to(socketidNow).emit('message-send', data)
                

                
            });
            socket.on('seen', (data) => {

                io.emit('seen', data)

            })
            socket.on('disconnect', async function () {

                await msgrUsers.findOneAndDelete({ socketid: socket.id })
            })
        });



        const user = database.collection('SMDatabase')
        const posts = database.collection('posts')
        // await posts.updateMany({},{$set:{date:"2024/7/12"}})
        // await posts.deleteMany({})
        // await posts.updateOne({},{$set:{dates:100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000}})
        app.get('/login', async (req, res) => {

            res.render('login.ejs')

        })
        app.get('/register', async (req, res) => {

            res.render('register.ejs')
        })
        app.get('/', async (req, res) => {

            if (req.session.isauthed == true) {
                let parms = req.query.page || 1
                const limit = 10
                const skip = (parms - 1) * limit
                var runtimed = await user.findOne({ email: req.session.email })


                var runtime = runtimed.pending
                let pendingwithnames = runtimed.pendingwithname
                var addruntime = runtimed.addedpending
                freindsruntime = runtimed.friends



                req.session.pending = runtime
                var usersid = runtime
                let userphota = await user.findOne({ email: req.session.email })
                userphota = userphota.photoext



                res.render('index.ejs', { pendingwithname: pendingwithnames, adminphoto: userphota, userid: req.session.userid, friends: freindsruntime, email: req.session.email, username: req.session.username, pending: req.session.pending, pendingid: usersid, addedpending: addruntime ? addruntime : [] })

            } else {
                res.redirect('/login')
            }
        })
        app.post('/get-msgr', async (req, res) => {

            const msgr = database.collection('msgr')
            const signout = req.body.signout
            const seen = req.body.makeSeenTrue
            const seenUser = req.body.seenUser
            const textEdit = req.body.textEdit
            const Index = req.body.Index
            const id = req.body.id
            const editmsg = req.body.editmsg
            const userid = req.body.userid
            const objID = req.body.objID
            const chatText = req.body.text
            const index = req.body.index
            const msg = req.body.msg
            const del = req.body.delete
            const userget = req.body.userget
            let lastindexmsg2 = req.body.index

            if(editmsg == true){
                const id2 = req.session.userid
                
                let dos = await msgr.findOne(
                    { _id: new ObjectId(id), messages: { $elemMatch: { index: Index } } },
                    { projection: { 'messages.$': 1 } }
                );
    
                const useriddef = dos.messages[0].userid
                console.log(useriddef,id2)
                if(id2 === useriddef){
                    await msgr.findOneAndUpdate({_id: new ObjectId(id),'messages.index':Index},{$set:{'messages.$.text' : textEdit,lastmsg:textEdit}})
                    res.end()

                }
                
            }else if (msg === true) {
                
                
                await msgr.findOneAndUpdate({ _id: new ObjectId(objID) },
                    {
                        $set: { seen: [{ userid: userid, seen: true }, { userid: userget, seen: false }], lastmsg: chatText },
                        $push: { messages: { text: chatText, userid: userid, index: lastindexmsg2 } }
                    })

            } else if (del === true) {

                let message = await msgr.findOne({ _id: new ObjectId(objID) })
                
                message = message.messages

                message = message.find(msg => msg.index === index)

                await msgr.findOneAndUpdate({ _id: new ObjectId(objID) }, { $pull: { messages: message } })
                let lstmsg = await msgr.findOne({ _id: new ObjectId(objID) })
                try {
                    lstmsg = lstmsg.messages.pop().text
                } catch {
                    lstmsg = 'No Last Message'
 
                }

                await msgr.findOneAndUpdate({ _id: new ObjectId(objID) }, { $set: { lastmsg: lstmsg } })

                res.json({ done: true })
            } else if (seen === true) {

                let message = await msgr.findOne({ _id: new ObjectId(objID) })
                let messageSeen = message.seen
                message = messageSeen.find(u => u.userid === seenUser)

                message.seen = true

                await msgr.findOneAndUpdate({ _id: new ObjectId(objID) }, { $set: { seen: messageSeen } })
                res.json({ done: true })
            } else if (signout === true) {
                req.session.isauthed = false
                res.json({ done: true })
            }

        })
        app.get('/get-msgr', async (req, res) => {
            const msgr = database.collection('msgr')

            let isUser = req.query.isUser
            let isMsg = req.query.isMsg
            let userid = req.query.userid
            let getID = req.query.getID
            let lastmsg = await msgr.findOne({ From: userid, To: getID })
            if (!lastmsg) {
                console.log('error');
                lastmsg = await msgr.findOne({ From: getID, To: userid })
            }


            const users = database.collection('SMDatabase')
            let friends = await users.findOne({ _id: new ObjectId(req.session.userid) })
            let listname = []
            if (isUser == "true") {

                for (let friend of friends.friends) {

                    let friendI = await users.findOne({ _id: new ObjectId(friend) })
                    let lastmsg = await msgr.findOne({ From: req.session.userid, To: friend })
                    if (!lastmsg) {
                        let lastmsg = await msgr.findOne({ From: friend, To: req.session.userid })
                        listname.push({ lastmsg: lastmsg.lastmsg, id: friend, username: friendI.username, photoext: friendI.photoext, seen: lastmsg.seen })

                    } else {
                        listname.push({ lastmsg: lastmsg.lastmsg, id: friend, username: friendI.username, photoext: friendI.photoext, seen: lastmsg.seen })
                    }
                }
                res.json({ info: listname })
            } else if (isMsg == 'true') {
                let photoext = await users.findOne({ _id: new ObjectId(getID) })
                let seen = lastmsg.seen

                res.json({ message: lastmsg.messages, id: lastmsg._id, photoext: photoext.photoext, username: photoext.username, seen: seen })
            }


        })
        app.get('/msgr', async (req, res) => {
            if (!req.session.isauthed) {
                res.redirect('/login')
            }
            const users = database.collection('SMDatabase')
            let adminphoto = await users.findOne({ _id: new ObjectId(req.session.userid) })
            res.render('msgr.ejs', { id: req.session.userid, adminphoto: adminphoto.photoext, username: adminphoto.username })
        })
        app.get('/get-posts/', async (req, res) => {
            // got by fetch method
            const query = req.query.page
            const feuser = req.query.user
            const socialdatabase = database.collection('posts')
            const clLen = await socialdatabase.countDocuments()

            let f_Num = clLen.toString().split('')
            const anotheruse = clLen.toString().split('')
            let skip;

            f_Num = f_Num.pop()
            if (f_Num == 0 && anotheruse.length > 1) {

                skip = clLen - (query * 10)
            } else if (f_Num > 0) {

                skip = clLen - f_Num - ((query - 1) * 10)
            }

            const limit = 10

            const users = database.collection('SMDatabase')
            const user = await users.findOne({ _id: new ObjectId(req.session.userid) })


            if (feuser) {

                const findalldata = await socialdatabase.find({ userid: feuser }).skip(skip).limit(limit).toArray()
                let allphotos = []
                for (value in findalldata) {


                    let getuser = await users.findOne({ _id: new ObjectId(findalldata[value].userid) })

                    allphotos.push({ id: getuser._id.toString(), photoext: getuser.photoext })


                }
                res.json({ findalldata: findalldata.reverse(), pending: user.pending, addedpending: user.addedpending, friends: user.friends, userid: req.session.userid, allphotos: allphotos })


            } else {
                const findalldata = await socialdatabase.find().skip(skip).limit(limit).toArray()

                let allphotos = []
                for (value in findalldata) {


                    let getuser = await users.findOne({ _id: new ObjectId(findalldata[value].userid) })

                    allphotos.push({ id: getuser._id.toString(), photoext: getuser.photoext })


                }


                // response of the posts and pending and addepending and firends and userid
                res.json({ findalldata: findalldata.reverse(), pending: user.pending || [{}], addedpending: user.addedpending || [{}], friends: user.friends || [{}], userid: req.session.userid, allphotos: allphotos })
            }

        })
        app.post('/register', async (req, res) => {
            const { email, password, username } = req.body;
            const hashed = await bcrypt.hash(password, 10)
            const resultto = await user.findOne({ email: email.toLowerCase() })
            if (!resultto) {

                if (email && password && username) {
                    let result = await user.insertOne({ email: email.toLowerCase(), password: hashed, username: username, friends: [], pending: [], addedpending: [], pendingwithname: [] })

                    res.redirect('/login')
                } else {
                    res.status(500).send('invalid inputs JSON PARSE!')
                }
            } else {
                res.send('the email is used before')
            }
        })
        app.post('/login', async (req, res) => {
            const { email, password } = req.body;

            const finduser = await user.findOne({ email: email.toLowerCase() })

            const hashed = finduser.password

            if (await bcrypt.compare(password, hashed)) {

                req.session.email = email.toLowerCase()

                req.session.userid = finduser._id

                req.session.username = finduser.username

                req.session.isauthed = true
                res.redirect('/')

            }

        })
        app.get('/search/:searchitem', async (req, res) => {
            const params = req.params.searchitem
            const Regular = new RegExp(params, 'i')
            const socialdatabase = database.collection('posts')
            const findalldata = await socialdatabase.find({ post: Regular }).toArray()
            const users = database.collection('SMDatabase')
            var user = await users.findOne({ _id: new ObjectId(req.session.userid) })
            let allphotos = []
            for (value in findalldata) {


                let getuser = await users.findOne({ _id: new ObjectId(findalldata[value].userid) })

                allphotos.push({ id: getuser._id.toString(), photoext: getuser.photoext })


            }
            const howMuch = findalldata.length

            res.render('searchio.ejs', { alldata: findalldata, howmany: howMuch, searchitem: params, pending: user.pending, addedpending: user.addedpending, friends: user.friends, userid: req.session.userid, allphotos: allphotos, username: req.session.username, email: req.session.email, adminphoto: user.photoext })
        })
        app.get('/user/:userid', async (req, res) => {
            if (!req.session.isauthed) {
                res.redirect('/login')
            } else {
                let prms = req.params.userid

                const socialdatabase = database.collection('posts');
                const user = database.collection('SMDatabase')
                let userphota = await user.findOne({ email: req.session.email })
                userphota = userphota.photoext

                let ids = new ObjectId(prms)

                let userinf = await user.findOne({ _id: ids })
                userinf = { id: userinf._id, username: userinf.username, email: userinf.email }
                let usrposts = await socialdatabase.find({ userid: prms }).toArray()

                // the adding of the / code 

                // var resultget = await socialdatabase.insertOne({post:'Hello',likes:1,username:'username'})
                var findalldata = await socialdatabase.find().toArray()

                var runtimed = await user.findOne({ email: req.session.email })




                var runtime = runtimed.pending

                var addruntime = runtimed.addedpending
                freindsruntime = runtimed.friends

                const friendrun = []
                for (friend in freindsruntime) {

                    friendrun.push(freindsruntime[friend])
                }


                req.session.pending = runtime
                var usersid = []
                for (one in runtime) {

                    const getUserByUsername = await user.findOne({ username: runtime[one] })
                    usersid.push(getUserByUsername._id)
                }
                var runtimeds = await user.findOne({ _id: ids })

                let typo = runtimeds.typo

                let friendcount = typeof runtimeds.friendcount !== 'undefined' ? runtimeds.friendcount : 0
                let postcount = typeof runtimeds.postcount !== 'undefined' ? runtimeds.postcount : 0

                let userphoto = await user.findOne({ _id: ids })

                res.render('userinfo.ejs', { addedpending: addruntime, adminphoto: userphota, typo: typo, userinfo: userinf, posts: usrposts, postcount: postcount, friendcount: friendcount, findalldata: findalldata, userid: req.session.userid, friends: friendrun, email: req.session.email, username: req.session.username, pending: req.session.pending, pendingid: usersid, addedpending: [addruntime], userphotopath: `${userphoto._id.toString()}.${userphoto.photoext}`, myid: req.session.userid, id: prms })
            }
        })
        app.post('/user/:id', async (req, res) => {

            if (!req.session.isauthed) {
                res.redirect('/login')
            } else {
                let prms = req.params.id

                const typochange = req.body.typo
                await user.findOneAndUpdate({ _id: new ObjectId(prms) }, { $set: { typo: typochange } })
                let photopath = req.files ? req.files.file : null;
                if (photopath) {

                    let fileext = photopath.name.split('.').pop()
                    let pathmake = path.join(__dirname, 'public/usersphoto', `${req.session.userid}.${fileext}`)
                    let prev_ext = await user.findOne({ _id: new ObjectId(prms) })
                    let usingext = prev_ext.photoext

                    if (usingext) {
                        fs.unlink(`./public/usersphoto/${prms}.${usingext}`, (err) => {
                            if (err) {
                                console.error('Error deleting the file:', err);
                            } else {
                                console.log('File deleted successfully');
                            }
                        });
                    }

                    await user.findOneAndUpdate({ _id: new ObjectId(prms) }, { $set: { hphoto: true, photoext: fileext } })
                    photopath.mv(pathmake, err => {
                        console.log('Sorry , ', err)
                    })
                    res.redirect(`/user/${prms}`)
                }
            }
        })
        app.get('/post/:id', async (req, res) => {
            if (!req.session.isauthed) {
                res.redirect('/login')
            }


            let params = req.params.id.toString()

            const posts = database.collection('posts')
            const users = database.collection('SMDatabase')
            let post = await posts.findOne({ _id: new ObjectId(params) })
            let user = await users.findOne({ _id: new ObjectId(req.session.userid) })
            let userp = await users.findOne({ _id: new ObjectId(post.userid) })


            const pending = user.pending
            const addedpending = user.addedpending
            const friends = user.friends
            const ext = userp.photoext
            const username = user.username
            const adminphoto = user.photoext


            res.json({ username: username, adminphoto: adminphoto, post: post, userid: req.session.userid, pending: pending, friends: friends, addedpending: addedpending, ext: ext ? ext : null })
        })
        app.post('/post/:id', async (req, res) => {
            const { userid, addlike, comment, commentID } = req.body;

            let params = new ObjectId(req.params.id);
            const posts = database.collection('posts')
            const users = database.collection('SMDatabase')
            let user = await users.findOne({ _id: new ObjectId(req.session.userid) })
            if (userid && addlike) {




                let chkIfLike = await posts.findOne({ _id: params })
                spficComment = chkIfLike.comments.find(c => c.id === commentID)
                let addlike;
                if (spficComment.wholike ? spficComment.wholike.indexOf(userid) < 0 : true) {


                    await posts.findOneAndUpdate({ _id: params, 'comments.id': commentID }, { $inc: { 'comments.$.likes': 1 } })
                    await posts.findOneAndUpdate({ _id: params, 'comments.id': commentID }, { $push: { 'comments.$.wholike': userid } })
                    addlike = true
                } else {
                    await posts.findOneAndUpdate({ _id: params, 'comments.id': commentID }, { $inc: { 'comments.$.likes': -1 } })
                    await posts.findOneAndUpdate({ _id: params, 'comments.id': commentID }, { $pull: { 'comments.$.wholike': userid } })
                    addlike = false

                }
                res.json({ addlike: addlike })
            } else {



                let likes = await posts.findOne({ _id: params })
                lengthcomment = likes.comments.length
                let info = { userid: user._id.toString(), comment: comment, username: user.username, photoext: user.photoext, likes: 0, id: lengthcomment + 1 }
                await posts.findOneAndUpdate({ _id: params }, { $push: { comments: info } })
                let postcommentcount = await posts.findOne({ _id: params })
                await posts.findOneAndUpdate({ _id: params }, { $set: { commentscount: postcommentcount.commentscount + 1 } })
                res.json({ info: info.id })
            }
        })
        app.post('/', async (req, res) => {

            let { email, post, deleted, likeplus, idnw, postnw, searchitem, useradded, useradder, userid, getRemoveFrom, username, getacc } = req.body;
            let photos
            try {
                photos = req.files.photos
            } catch (error) {
                console.log('error')
            }


            const socialdatabase = database.collection('posts');
            const user = database.collection('SMDatabase')
            if (req.session.isauthed) {
                if (getacc == 1) {
                    let xuser = req.session.userid

                    let zuser = username


                    let username2 = new ObjectId(username)

                    // Remove Request From Addpending and Pending
                    await user.findOneAndUpdate({ _id: username2 }, { $pull: { addedpending: xuser } })
                    await user.findOneAndUpdate({ _id: new ObjectId(req.session.userid) }, { $pull: { pending: zuser } })
                    let use = await user.findOne({ _id: new ObjectId(zuser) })

                    await user.findOneAndUpdate({ _id: new ObjectId(req.session.userid) }, { $pull: { pendingwithname: { userid: zuser.toString(), username: use.username } } })

                    // Add The Friend To Both ACCs
                    await user.findOneAndUpdate({ _id: username2 }, { $push: { friends: xuser } })
                    await user.findOneAndUpdate({ _id: new ObjectId(req.session.userid) }, { $push: { friends: zuser } })
                    //plus more one in friends count !

                    let friendcount = await user.findOne({ _id: username2 })


                    if (typeof friendcount.friendcount === 'undefined') {
                        friendcount = 1
                    } else {
                        friendcount = friendcount.friendcount + 1
                    }
                    await user.findOneAndUpdate({ _id: username2 }, { $set: { friendcount: friendcount } })
                    // for the another one
                    let friendcount2 = await user.findOne({ _id: new ObjectId(req.session.userid) })

                    if (typeof friendcount2.friendcount === 'undefined') {
                        friendcount2 = 1
                    } else {
                        friendcount2 = friendcount2.friendcount + 1
                    }
                    await user.findOneAndUpdate({ _id: new ObjectId(req.session.userid) }, { $set: { friendcount: friendcount2 } })

                    const msgr = database.collection('msgr')
                    await msgr.insertOne({ From: req.session.userid, To: username, lastmsg: "", messages: [], seen: [] })


                } else if (getRemoveFrom == 1) {

                    let usernameA = new ObjectId(username)

                    await user.findOneAndUpdate({ _id: new ObjectId(req.session.userid) }, { $pull: { pending: username } })
                    let userinfo = await user.findOne({_id : usernameA})
                    await user.findOneAndUpdate({_id : new ObjectId(req.session.userid)},{$pull : {pendingwithname : {userid:  username,username:userinfo.username}}})

                    await user.findOneAndUpdate({ _id: usernameA }, { $pull: { addedpending: req.session.userid } })



                } else if (typeof useradded !== 'undefined') {
                    const user = database.collection('SMDatabase')

                    var chkexistince = await user.findOne({ _id: new ObjectId(useradded) })


                    chkel = chkexistince.pending

                    let userinfo1 = await user.findOne({ _id: new ObjectId(useradder) })



                    if (!chkel.includes(useradder)) {
                        await user.findOneAndUpdate({ _id: new ObjectId(useradded) }, { $push: { pending: useradder } })
                        console.log({userid: useradder, username: userinfo1.username})
                        await user.findOneAndUpdate({ _id: new ObjectId(useradded) }, { $push: { pendingwithname: { userid: useradder, username: userinfo1.username } } })


                        await user.findOneAndUpdate({ _id: new ObjectId(useradder) }, { $push: { addedpending: useradded } })
                    }

                    await user.findOne({ _id: new ObjectId(useradded) })


                } else if (typeof deleted !== 'undefined') {
                    idobj = new ObjectId(deleted)
                    const user = database.collection('SMDatabase')

                    // find info to fetch posts number and minus them - 1 !
                    let userinfoget = await socialdatabase.findOne({ _id: idobj })
                    for (let one in userinfoget.photos) {

                        const photopath = path.join(__dirname, '/public/posts/', userinfoget.photos[one])

                        fs.unlink(photopath, (error) => {
                            if (error) {
                                console.error(error)
                            } else {
                                console.log('file deleted !')
                            }
                        })
                    }
                    let usrid = new ObjectId(userinfoget.userid)

                    let userposts = await user.findOne({ _id: usrid })
                    userposts = userposts.postcount - 1
                    // updateing push /pushing side :
                    await user.findOneAndUpdate({ _id: usrid }, { $set: { postcount: userposts } })
                    // delete and push 
                    await socialdatabase.findOneAndDelete({ _id: idobj })

                    res.json({ successdel: true })


                } else if (typeof searchitem !== 'undefined') {
                    let regsearchitem = new RegExp(searchitem, 'i')

                    var result = await socialdatabase.find({ post: regsearchitem }).toArray()
                    const allresultphotos = []

                    for (value in result) {

                        let userget = await user.findOne({ _id: new ObjectId(result[value].userid) })
                        if (allresultphotos.indexOf({ id: userget._id.toString(), photoext: userget.photoext }) < 0) {
                            allresultphotos.push({ id: userget._id.toString(), photoext: userget.photoext })



                        }

                    }


                    res.json({ datasearch: result, photosresult: allresultphotos, searchitem: searchitem })
                } else if (typeof idnw !== 'undefined') {
                    var idobj = new ObjectId(idnw)
                    var update = socialdatabase.updateOne({ _id: idobj }, { $set: { post: postnw } })
                } else if (typeof likeplus !== 'undefined') {
                    idobj = new ObjectId(likeplus)
                    var addlike = await socialdatabase.findOne({ _id: idobj })
                    likes = addlike.likes + 1
                    var likedposts = database.collection('likedposts')
                    var likedpostadd = await likedposts.findOne({ email: email, postid: likeplus })
                    await socialdatabase.updateOne({ _id: idobj }, { $push: { wholike: req.session.userid } })



                    if (likedpostadd) {
                        likes = addlike.likes - 1

                        await socialdatabase.updateOne({ _id: idobj }, { $set: { likes: likes } })
                        await socialdatabase.updateOne({ _id: idobj }, { $pull: { wholike: req.session.userid } })

                        removethepostfromliked = likedposts.findOneAndDelete({ email: email, postid: likeplus })
                        res.json({ success: true, addone: false });
                    } else {
                        await likedposts.insertOne({ email: email, postid: likeplus })
                        await socialdatabase.updateOne({ _id: idobj }, { $set: { likes: likes } })
                        res.json({ success: true, addone: true });
                    }
                } else {
                    let listidphotos = []


                    if (photos) {
                        if (photos.length) {
                            for (let photo in photos) {

                                let ext = photos[photo].name.split('.').pop()
                                let x = Date.now().toString(36) + Math.random(36).toString(36)


                                photos[photo].mv(path.join(__dirname, '/public/posts', `${x}.${ext}`))
                                listidphotos.push(`${x}.${ext}`)
                            }
                        } else {
                            let ext = photos.name.split('.').pop()
                            let x = Date.now().toString()
                            listidphotos.push(`${x}.${ext}`)
                            photos.mv(path.join(__dirname, '/public/posts', `${x}.${ext}`))
                        }
                    }


                    const user = database.collection('SMDatabase')
                    const finduser = await user.findOne({ email: email });
                    const username = finduser.username
                    try {
                        const date = new Date()

                        const dateEdit = `${date.getFullYear()}/${date.getUTCMonth() + 1}/${date.getDate()}`
                        let useriddef = new ObjectId(userid)
                        const resulted = await socialdatabase.insertOne({ username: username, post: post, likes: 0, userid: userid, wholike: [], photos: listidphotos, comments: [], commentscount: 0, date: dateEdit });
                        let postcount = await user.findOne({ _id: useriddef })


                        if (typeof postcount.postcount == 'undefined') {
                            postcount = 1
                        } else {
                            postcount = postcount.postcount + 1
                        }
                        await user.findOneAndUpdate({ _id: useriddef }, { $set: { postcount: postcount } })

                        res.json({ success: true, insertedId: resulted.insertedId, username: username, post: post, userid: userid, photos: listidphotos });

                    } catch (error) {
                        console.error('Error inserting post:', error);
                        res.status(500).json({ success: false, error: 'Error inserting post' });
                    }
                }

            } else {
                res.status(401).json({ success: false, error: 'Unauthorized' });
            }
        });
    } catch (err) {
        console.log(err)
    }
}


main()
process.on('uncaughtException', function (error, orgin) {
    console.log(error, orgin)
})
server.listen(port, () => {
    console.log('The Server Is Working In ', port)
})