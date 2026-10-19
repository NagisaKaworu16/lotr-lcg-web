/* Original Core Set starter fixtures: rulebook p.10 and original card quantities.
 * Heroes never enter the 30-card draw decks. Four decks use 120 player cards in total.
 */
const STARTER_DECKS={
 sourceUrl:'https://hallofbeorn-resources.s3.amazonaws.com/Images/LotR/Rules/MEC01.pdf',rulebookPage:10,
 decks:[
 {id:'starter-leadership',name:'领导基础教学牌组',sphere:'leadership',mode:'starter',heroes:['01001','01002','01003'],slots:{'01013':3,'01014':2,'01015':2,'01016':3,'01017':2,'01018':2,'01019':1,'01020':2,'01021':2,'01022':2,'01023':2,'01024':2,'01025':1,'01026':2,'01027':1,'01073':1}},
 {id:'starter-tactics',name:'战术基础教学牌组',sphere:'tactics',mode:'starter',heroes:['01004','01005','01006'],slots:{'01028':3,'01029':3,'01030':2,'01031':1,'01032':3,'01033':2,'01034':2,'01035':2,'01036':2,'01037':1,'01038':1,'01039':2,'01040':2,'01041':2,'01042':1,'01073':1}},
 {id:'starter-spirit',name:'精神基础教学牌组',sphere:'spirit',mode:'starter',heroes:['01007','01008','01009'],slots:{'01043':2,'01044':3,'01045':2,'01046':2,'01047':2,'01048':2,'01049':2,'01050':2,'01051':3,'01052':2,'01053':1,'01054':1,'01055':2,'01056':2,'01057':1,'01073':1}},
 {id:'starter-lore',name:'知识基础教学牌组',sphere:'lore',mode:'starter',heroes:['01010','01011','01012'],slots:{'01058':3,'01059':2,'01060':1,'01061':2,'01062':2,'01063':3,'01064':2,'01065':2,'01066':2,'01067':2,'01068':1,'01069':2,'01070':2,'01071':1,'01072':2,'01073':1}}
 ]
};
if(typeof module!=='undefined')module.exports=STARTER_DECKS;
