const express=require("express")
const mongoose=require("mongoose")
const path=require("path")
const ejsMate= require("ejs-mate")
const methodOverride=require("method-override")
const { v4: uuidv4 } = require('uuid');
const passportLocalMongoose=require("passport-local-mongoose");
const passport=require("passport");
const localStrategy=require("passport-local");
const nodemailer=require("nodemailer");
require('dotenv').config();
const session=require("express-session");
const { error, info } = require("console")
const { type } = require("os")
const app=express()
const flash = require('connect-flash');
app.use(flash());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.engine("ejs",ejsMate);
app.use(methodOverride("_method"));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
const multer  = require('multer');
const {storage}=require("./cloudConfig")
const { link } = require("fs")
const { toUnicode } = require("punycode")
const upload = multer({ storage })
const mongo_url='mongodb://127.0.0.1:27017/amritaian';
const dburl="mongodb+srv://navaneethabs2006:Tx35Tx3LbMewPmlP@cluster0.5n62k.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
const sessionOptions={
    secret:process.env.SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        expires: Date.now() + 7*24*60*60*1000,  
        maxAge:7*24*60*60*1000,
    },
    httpOnly:true,
};
main().then(()=>{
    console.log("connected-successfully");
}).catch((error)=>{
    console.log("not connected");
    console.log(error)
})
async function main(){
    await mongoose.connect(dburl);
}

const user_schema=new mongoose.Schema({
    email:{
        type:String,
        required:true
    },
    bio:{
        type:String,
        required:false,
        default:""
    },
    security:{
        type:[String],
        required:true
    },
    dp:{
        type:String,
        required:false,
        default:"https://res.cloudinary.com/du1tos77l/image/upload/v1733041749/amritaian-dev/yaodauqf6av7k9mqyozy.png"
    },
    notifications: {
        type: [
            {
                message: { type: String, required: true },
                noti_type:{type:String, required:true},
                date: { type: Date, default: Date.now },
                isRead: { type: Boolean, default: false },
            },
        ],
        default: [],
    },
    following:{
        type:[String],
        default:[]
    },
    followers:{
        type:[String],
        default:[]
    },
    saved_posts:{
        type:[String],
        required:false
    }
})
const post_schema=new mongoose.Schema({
    p_user:{
        type:String,
        required:true
    },
    photo_link:{
        type:String,
        required:false
    },
    description:{
        type:String,
        required:false
    },
    likes:{
        type:[String],
        required:false
    },
    date:{
        type:Date,
        default:Date.now
    },
    comments:{
        type:[
            {
                user_com:{type:String,required:true},
                text_com:{type:String,required:true}
            }
        ],
        default:[]
    },
    expiry:{
        type:Date,
        default:null,
        index:{
            expires:0
        }
    },
    post_type:{
        type:String,
        required:true
    }
})
const note_schema=new mongoose.Schema({
    note:{
        type:String,
        required:true
    },
    user_note:{
        type:String,
        required:true
    },
    date:{
        type:Date,
        default:Date.now,
        index:{expires:'1d'}
    }
})
const chatting_schema=new mongoose.Schema({
    first_user:{
        type:String,
        required:true
    },
    second_user:{
        type:String,
        required:true
    },
    time_s:{
        type:Date,
        default:Date.now
    },
    mesg:{
        type:String,
        required:true
    },
    read:{
        type:Boolean,
        default:false
    }
})
const todoschema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    completed: {
        type: Boolean,  
        default: false
    },
    priority:{
        type:Number,
        default:3
    },
    id: {
        type: String,
        default: uuidv4,
    },
    username:{
        type:String,
        required:true
    },
    date:{
        type:Date,
        default:Date.now,
        index:{expires:'1d'}
    }
});
user_schema.plugin(passportLocalMongoose);
const post=mongoose.model("post",post_schema);
const User=mongoose.model('User',user_schema);
const msg=mongoose.model('msg',note_schema);
const chatting=mongoose.model('chatting',chatting_schema);
const todo=mongoose.model('todo',todoschema);
app.use(session(sessionOptions));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new localStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
let status="not logged in";
// let loginurl="";
const follow_requests=[];
app.get("/login",async(req,res)=>{
    // const referrerUrl = req.headers.referer || '/home';
    // loginurl=referrerUrl
    res.render("../views/login.ejs");
})
app.get("/home",async(req,res)=>{
    const posts_all=await post.find({}).sort({date:-1});
    // console.log(posts_all)
    const filteredPosts = [];
    const dps=[];
    const isfol=[];
    for(const post of posts_all){
        const userexists = await User.findOne({ username: post.p_user });
        // console.log(userexists);
        if(userexists && post.post_type=="private" && req.isAuthenticated()){
            const aauser=await User.findOne({username:post.p_user});
            // console.log(aauser);
            const userex=aauser.following.indexOf(req.user.username);
            // console.log(userexists+" "+post.post_type);
            if(aauser.username!=req.user.username && userex==-1){
                posts_all.splice(posts_all.indexOf(post),1);
            }
        }
        else if(userexists && post.post_type=="private" && !req.isAuthenticated()){
            // console.log(userexists+" "+post.post_type);
            posts_all.splice(posts_all.indexOf(post),1);
        }
    }
    for (const post of posts_all) {
        const userexists = await User.findOne({ username: post.p_user });
        if (userexists) {
            filteredPosts.push(post); // Add valid posts to a new array
            dps.push(userexists.dp);
            let ispre=false;
            if(req.isAuthenticated()){
                for(const fol of req.user.following){
                    if(fol==userexists.username){
                        isfol.push("UnFollow");
                        ispre=true;
                    }
                }
            }if(!ispre || !req.isAuthenticated){
                isfol.push("follow");
            }
            ispre=false;
        }else{
            await post.deleteOne({_id:post._id});
        }
    }
    let pre_user=""
    let k_user="";
    if(status=="not logged in" && !req.isAuthenticated()){
        pre_user=status;
    }else{
        k_user=req.user;
        pre_user=k_user.username;
    }
    const unfol=[];
    const allusers=await User.find({});
    for(const con of allusers ){
        if(req.isAuthenticated()){
            const userexists=await req.user.following.indexOf(con.username);
            if(userexists==-1 && con.username!=req.user.username){
                unfol.push(con);
            }
        }
    }
    const bg=[];
    for(const fp of filteredPosts){
        if(req.isAuthenticated()){
            const u=req.user.username;
            const le=fp.likes.indexOf(u);
            if(le!=-1){
                bg.push("red");
            }else{
                bg.push("white");
            }
        }else{
            bg.push("white");
        }
    }
    const savebgs=[];
    if(req.isAuthenticated()){
        for(const fp of filteredPosts){
            const id=fp._id;
            const poste=req.user.saved_posts.indexOf(id);
            if(poste>=0){
                savebgs.push("saved");
            }else{
                savebgs.push("no");
            }
        }
    }
    // console.log(pre_user);
    let count4=0;
    if(req.isAuthenticated()){
        for(const noti of k_user.notifications){
            if(!noti.isRead){
                count4++;
            }
        }
    }
    
    res.render("../views/index.ejs",{filteredPosts,dps,bg,pre_user,isfol,unfol,savebgs,k_user,count4});
})
app.get("/signup",async(req,res)=>{
    res.render("../views/signup.ejs");
})
app.post("/signup",upload.single('dp'),async(req,res)=>{
    let {username,email,bio,security1,security2,password}=req.body;
    const dpl = req.file ? req.file.path : null; // Check if the file exists, else set to null
    // console.log("dp "+dpl);
    let new_user="";
    const security=[security1,security2];
    if(dpl==null){
        new_user=new User({email:email,bio:bio,security:security,username:username});
    }else{
        new_user=new User({email:email,bio:bio,security:security,username:username,dp:dpl});
    }
    const userexists=await User.findOne({username:username});
    if(userexists){
        return res.status(400).send("username already exists");
    }
    const registereduser=await User.register(new_user,password);
    req.logIn(registereduser,(err)=>{
        if(err){
            return next(err);
        }
        // console.log(registereduser);
        status="logged in"
        res.redirect("/home");
    })
})
app.post("/login",passport.authenticate("local",{failureRedirect:"/login"}),async(req,res)=>{
    status="logged in"
    // console.log(status);
    // console.log(loginurl);
    res.redirect("/home");
})
app.post("/settings/logout",async(req,res)=>{
    req.logOut((err)=>{
        if(err){
            return next(err);
        }
        status="not logged in"
        res.redirect("/home");
    })
})
app.get("/settings",async(req,res)=>{
    let pro="";
    if(req.isAuthenticated()){
        pro=req.user;
    }
    // console.log(pro);
    res.render("settings.ejs",{status,pro})
})
app.get("/newpost",async(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        res.render("newpost.ejs",{status});
    }
})
app.post("/newpost",upload.single('img'),async(req,res)=>{
    try {
        const present_user = req.user;
        const puser = present_user.username;
        const link = req.file ? req.file.path : null;
        const {description,expiration,posttype} = req.body;
        const matter = description;
        let expiresAt=null;
        if (expiration === '1d') {
            expiresAt = new Date(Date.now() + 5 * 1000); // 1 day
        } else if (expiration === '7d') {
            expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        } 
        let pt="public"
        if(posttype=='private'){
            pt="private";
        }
        const newpost = new post({
            p_user: puser,
            photo_link: link, 
            description: matter,
            likes:[],
            expiry:expiresAt,
            post_type:pt
        });
        await newpost.save();
        // console.log(newpost);
        res.redirect("/home");
    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).send("Internal Server Error");
    }
    
})  
app.put("/home/:id/like",async(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        const {id}=req.params;
        const lp=await post.findById(id);
        // console.log(id);
        const luser=req.user.username;
        const ispresent=lp.likes.indexOf(luser);
        if(ispresent>=0){
            lp.likes.splice(ispresent,1);
        }else{
            lp.likes.push(luser);
        }
        await lp.save();
        const loginurl=req.headers.referer || '/home';
        res.redirect(loginurl);
    }
    
})

app.put("/home/:id/addcomment",async(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        const {id}=req.params;
        const {newcom}=req.body;
        const user_com=req.user;
        const cpost=await post.findById(id);
        cpost.comments.push({user_com:user_com.username,text_com:newcom});
        // console.log(newcom);
        // console.log(cpost);
        await cpost.save();
        const referrerUrl = req.headers.referer || '/home';
        res.redirect(referrerUrl);

    }

})
app.get("/home/:id",async(req,res)=>{
    const {id}=req.params;
    const cpost=await post.findById(id);
    const un=cpost.p_user
    const mu=await User.findOne({username:un});
    const mu_dp=mu.dp;
    const comments_all=cpost.comments;
    let bg="white";
    let pu="";
    if(req.isAuthenticated()){
        const u=req.user.username;
        pu=u;
        const ue=cpost.likes.indexOf(u);
        if(ue>=0){
            bg="red";
        }
    }
    res.render("../views/post.ejs",{cpost,mu_dp,comments_all,bg,pu});
})

app.delete("/home/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const cpost = await post.findById(id);
        const users=await User.find({});
        for(const use of users){
            const ind=use.saved_posts.indexOf(id);
            if(ind>=0){
                use.saved_posts.splice(ind,1);
            }
        }
        if (!cpost) {
            return res.status(404).send("Post not found");
        }
        const un = cpost.p_user;
        const mu = await User.findOne({ username: un });
        if (!mu) {
            return res.status(404).send("User associated with the post not found");
        }

        await post.findByIdAndDelete(id);
        res.redirect("/home");
    } catch (error) {
        console.error("Error in delete route:", error);
        res.status(500).send("An error occurred while deleting the post");
    }
});


app.put("/home/:name/following",async(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        const {name}=req.params;
        const ind=req.user.following.indexOf(name);
        const ouser=await User.findOne({username:name});
        const referrerUrl = req.headers.referer || '/home';
        console.log(referrerUrl); 
        if(ind>=0){
            res.redirect(referrerUrl);
        }else{  
            if(ouser.notifications.findIndex(notification=>notification.message===req.user.username)==-1){
                await ouser.notifications.push({message:req.user.username,noti_type:"f"});
            }
            // await req.user.following.push(name);
            // await req.user.save();
            // await ouser.followers.push(req.user.username);
            await ouser.save();
            res.redirect(referrerUrl);
        }
        
    }
    
})

app.get("/notifications",async(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        const user=req.user;
        const notifications=[];
        const dps=[];
        for(const noti of user.notifications){
            if(!noti.isRead){
                notifications.push(noti);
                const vadu=await User.findOne({username:noti.message});
                dps.push(vadu);
            }
        }
        console.log(notifications);
        res.render("../views/notifi.ejs",{notifications,dps});
    }
})
app.post("/notifications/:name/accept",async(req,res)=>{
    const user=req.user;
    const{name}=req.params;
    const sentuser=await User.findOne({username:name});
    const index = user.notifications.findIndex(notification => notification.message === name);
    if (index !== -1) {
        user.notifications.splice(index, 1); 
        await user.save();
    }
    await user.followers.push(name);
    await sentuser.following.push(user.username);
    await user.save();
    await sentuser.save();
    res.redirect("/notifications");
})
app.post("/notifications/:name/reject",async(req,res)=>{
    const user = req.user; 
    const { name } = req.params; 
    const index = user.notifications.findIndex(notification => notification.message === name);
    
    if (index !== -1) {
        user.notifications.splice(index, 1); 
        await user.save();
    }

    res.redirect("/notifications");
})


app.get("/chat",async(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        const follwers=await req.user.followers;
        const follwing=await req.user.following;
        const dps=[];
        // console.log(follwers);
        for(const foler of follwers){
            const use=await User.findOne({username:foler});
            if(use){
                dps.push(use.dp);
            }
        }
        for(const foling of follwing){
            const use=await User.findOne({username:foling});
            if(use && req.user.followers.indexOf(use.username)==-1){
                dps.push(use.dp);
            }else if(use){
                follwing.splice(follwing.indexOf(use),1);
            }
        }

        // console.log(dps);
        res.render("../views/chatting.ejs",{follwers,follwing,dps});
        }
    
})
app.get("/chat/:name",async(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        const {name}=req.params;
        const sec_user=await User.findOne({username:name});
        const referrerUrl = req.headers.referer || '/home';
        console.log(referrerUrl);    
        let value="";
        if(referrerUrl=="http://localhost:3000/notes?"){
            value="@replyToYourNote"
        }
        const fir_user=req.user;
        const chats1=await chatting.find({
            $or: [
                { $and: [{ first_user: fir_user.username }, { second_user: sec_user.username }] },
                { $and: [{ first_user: sec_user.username }, { second_user: fir_user.username }] }
            ]
        }).sort({time_s:1});
        const chats2=[];
        chats1.forEach(chat => {
            chats2.push(chat.mesg);
        });
        // console.log(chats2);
        const unread=await chatting.find({ $and: [{ first_user: sec_user.username }, { second_user: fir_user.username }] });
        // console.log(unread);
        for(const chat of unread){
            chat.read=true;
            await chat.save();
        }
        for(const noti of req.user.notifications){
            if(noti.message==name){
                noti.isRead=true;
            }
        }
        console.log(fir_user.notifications);
        const ind=fir_user.notifications.findIndex(notification=>notification.message==sec_user.username);
        fir_user.notifications.splice(ind,1);
        await fir_user.save();
        res.render("../views/texting.ejs",{fir_user,sec_user,chats1,value});
    }
})

app.post("/chat/:name",async(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        const {name}=req.params;
        const sec_user=await User.findOne({username:name});
        const fir_user=req.user;
        const {nMsg}=req.body;
        const newm=new chatting({
            first_user:fir_user.username,
            second_user:sec_user.username,
            mesg:nMsg
        })
        await newm.save();
        sec_user.notifications.push({message:fir_user.username,noti_type:"c"});
        await sec_user.save();
        res.redirect("/chat/"+sec_user.username);
    };
})
app.get("/edit/:name",async(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        const {name}=req.params;
        const user=await User.findOne({username:name});
        const present_user=req.user;
        const posts=await post.find({p_user:name})
        const userexists=req.user.following.indexOf(name);
        let send="Follow"
        if(userexists>=0){
            send="Following";
        }
        if(name==req.user.username){
            send="";
        }
        const following=await user.following;
        const followers=await user.followers;
        let canview=false;
        const ind=following.indexOf(present_user.username);
        if(ind>=0 || present_user.username==user.username){
            canview=true;
        }
        console.log(followers);
        console.log(following);
        res.render("../views/user.ejs",{user,posts,send,present_user,canview,following,followers});
    }
    
})


app.get("/notes",async(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        const nameuser=req.user;
        const allnotes=[];
        for(const followi of nameuser.following){
            // const auser=await User.findOne({username:followi});
            const not=await msg.findOne({user_note:followi});
            if(not){
                allnotes.push(not);
            }
        }
        const pre_not=await msg.findOne({user_note:nameuser.username})
        // const allnotes=await msg.find({}).sort({date:-1});
        if(pre_not){
            allnotes.push(pre_not);
        }
        // console.log(allnotes);
        // console.log(pre_not);
        const user_f=[];
        for(const note of allnotes){
            const username=note.user_note;
            const user=await User.findOne({username:username});
            const dp=user.dp;
            user_f.push(dp);
            // console.log(user);
        }
        // console.log(allnotes);
        // console.log(user_f);
        res.render("../views/notes.ejs",{allnotes,user_f,nameuser});
    }
    
})
app.delete("/note/delete",async(req,res)=>{
    const user=req.user.username;
    await msg.findOneAndDelete({user_note:user});
    // await msg.save();
    res.redirect("/notes");
})
app.get("/notes/newnote",async(req,res)=>{
    const present_user=req.user.username;
    const userexists=await msg.find({user_note:present_user});
    // console.log(userexists+" en");
    if(userexists.length>=1){
        res.send("only 1 note per day");
    }else{
        res.render("../views/newnote.ejs");
    }
    
})
app.post("/notes/newnote",async(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        const {note}=req.body;
        // console.log(note);
        const user_note=req.user.username;
        const new_note=new msg({
            note:note,
            user_note:user_note
        });
        await new_note.save();
        res.redirect("/notes");
    }
})

app.delete("/:user/delete",async(req,res)=>{
    const {user}=req.params;
    // console.log(user);
    await post.deleteMany({p_user:user});
    await msg.deleteMany({user_note:user});
    await chatting.deleteMany({first_user:user});
    await chatting.deleteMany({second_user:user});
    const fu=req.user;
    const alluser=await User.find({});
    for(const use of alluser){
        const ind1=use.following.indexOf(fu.username);
        const ind2=use.followers.indexOf(fu.username);
        if(ind1>=0){
            use.following.splice(ind1,1);
        }
        if(ind2>=0){
            use.followers.splice(ind2,1);
        }
        await use.save();
    }
    req.logOut((err)=>{
        if(err){
            return next(err);
        }
        status="not logged in"
    })
    await User.deleteMany({username:user});
    

    res.redirect("/signup");
})

app.put("/unfollow/:fu/:su",async(req,res)=>{
    const {fu,su}=req.params;
    const ue_fu=await User.findOne({username:fu});
    const ue_su=await User.findOne({username:su});
    const referrerUrl = req.headers.referer || '/home';
    if(ue_fu && ue_su){
        const ind1=ue_fu.following.indexOf(ue_su.username);
        ue_fu.following.splice(ind1,1);
        const ind2=ue_su.followers.indexOf(ue_fu.username);
        ue_su.followers.splice(ind2,1);
    }
    await ue_fu.save();
    await ue_su.save();
    res.redirect(referrerUrl);
})


let fpuser="";
app.put("/forgotpassword",async(req,res)=>{
    const {un}=req.body;
    const usaer=await User.findOne({username:un});
    if(!usaer){
        return res.status(404).send("user not found");
    }else{
        fpuser=usaer;
        // console.log(fpuser);
        res.redirect("/fpassword");
    }

});
app.get("/fpassword",async(req,res)=>{
    // console.log(fpuser);
    res.render("../views/fp.ejs",{fpuser});
})
app.get("/resetpass/:name",async(req,res)=>{
    let {name}=req.params;
    let user=await User.findOne({username:name});
    let {security4,security5}=req.query;
    if(user){
        if(user.security.indexOf(security4)==0 && user.security.indexOf(security5)==1){
            res.render("../views/resetpass.ejs",{user});
        }else{
            // console.log(fpuser.security);
            res.send("wrong answers or user not found");
        }
    }else{
        // console.log(fpuser);
        res.send("wrong answers or user not found");
    }
})

app.put("/resetpass/:name", async (req, res) => {
    const { name } = req.params;
    const { password } = req.body;
    // console.log(password);
    try {
        const user = await User.findOne({ username: name });
        if (!user) {
            return res.status(404).send("User not found");
        }

        await user.setPassword(password);
        await user.save();

        res.redirect("/login");
    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).send("An error occurred");
    }
});

app.put("/:id/save",async(req,res)=>{
    if(!req.isAuthenticated){
        res.redirect("/login");
    }else{
        const user=req.user;
        const {id}=req.params;
        user.saved_posts.push(id);
        await user.save();
        res.redirect("/home");
    }
})
app.put("/:id/unsave",async(req,res)=>{
    if(!req.isAuthenticated){
        res.redirect("/login");
    }else{
        const user=req.user;
        const {id}=req.params;
        const ind =user.saved_posts.indexOf(id);
        if(ind>=0){
            user.saved_posts.splice(ind,1);
        }
        await user.save();
        const redirecturl=req.headers.referer || '/home'
        res.redirect(redirecturl);
    }
})
app.get("/:name/savedposts", async (req, res) => {
    let saveposts = [];
    let dps = [];
    let isfol = [];
    let pre_user = "not logged in";
    let bg = [];
    
    if (req.isAuthenticated()) {
        const user = req.user;
        pre_user = user.username;
        
        for (const linkd of user.saved_posts) { 
            // console.log(linkd);
            
            const p = await post.findOne({ _id: linkd }); 
            if (!p) continue; 
            
            const u = await User.findOne({ username: p.p_user });
            const fol = user.following;

            if (fol.indexOf(p.p_user) === -1 && p.p_user !== user.username) {
                isfol.push("follow");
            } else {
                isfol.push("UnFollow");
            }

            saveposts.push(p);
            dps.push(u?.dp || ""); 
            const un = req.user.username;
            const le = p.likes.indexOf(un);
            
            if (le !== -1) {
                bg.push("red");
            } else {
                bg.push("white");
            }
        }
    }

    res.render("../views/savedposts.ejs", { saveposts, pre_user, isfol, dps, bg });
});
app.get("/todolist",async(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        const username=req.user.username;
        res.render("../views/todolist.ejs",{username});
    }
})
app.get("/todolist/newtodo",async(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        const username=req.user.username;
        const alltodos=await todo.find({}).sort({date:1});
        const user_f=[];
        for(const todo of alltodos){
            const use=await User.find({username:todo.username});
            user_f.push(use.dp);
        }
        res.render("../views/newtodo.ejs",{username,alltodos,user_f});
    }
})
app.post("/todolist/newtodo",async(req,res)=>{
    const newtodo = new todo({
        title: req.body.task,
        username:req.user.username,
        priority:req.body.priority
    });
    await newtodo.save();
    res.redirect("/todolist");
})


app.get("/useredit/:name",async(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect("/login");    
    }else{
        const {name}=req.params;
        const user=await User.findOne({username:name});
        res.render("../views/edit_user.ejs",{user});
    }
    
})

app.put("/useredit/:name",upload.single('dp'),async(req,res)=>{
    const {name}=req.params;
    const user=await User.findOne({username:name});
    let {username,email,bio,security1,security2}=req.body;
    const dpl = req.file ? req.file.path : null; // Check if the file exists, else set to null
    // console.log("dp "+dpl);
    if(user.username!=username){
        const userexists=await User.findOne({username:username});
        if(userexists){
            return res.status(400).send("username already exists");
        }
    }
    user.username=username;
    user.email=email;
    user.bio=bio;
    user.security[0]=security1;
    user.security[1]=security2;
    if(dpl!=null){
        user.dp=dpl;
    }
    await user.save();
    // res.redirect("/home");
    // const registereduser=await User.register(new_user,password);
    req.logIn(user,(err)=>{
        if(err){
            return next(err);
        }
        // console.log(registereduser);
        status="logged in"
        res.redirect("/home");
    })
})
app.get("/:name/followers",async(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
    const {name}=req.params;
    const user=await User.findOne({username:name});
    const followers=[];
    const isfoll=[];
    for(const each of user.followers){
        const use=await User.findOne({username:each});
        const isfol=user.following.indexOf(each);
        if(isfol==-1){
            isfoll.push("Follow");
        }else{
            isfoll.push("Unfollow");
        }
        followers.push(use);
    }
    const use=req.user;
    res.render("../views/followers.ejs",{followers,isfoll,use});
}
})
app.get("/:name/following",async(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
    const {name}=req.params;
    const use=req.user;
    const user=await User.findOne({username:name});
    const following=[];
    for(const each of user.following){
        const use=await User.findOne({username:each});
        following.push(use);
    }
    res.render("../views/following.ejs",{following,use});}
})

app.listen(3000, () => {
    console.log("I am listening on port 3000");
});
app.get("/",async(req,res)=>{
    res.redirect("/home");
})
