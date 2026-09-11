import {api,localDate} from './ui.js';
export const state={data:null,config:null,page:'timeline',demo:false,category:'all',view:'week',anchor:localDate(),parent:null,search:'',sort:'start',status:'all',customStart:localDate(),customEnd:localDate(),journalSearch:''};
export const live=collection=>state.data[collection].filter(r=>!r.deleted);
export const categoryOf=id=>live('categories').find(c=>c.id===id)||{name:'未分类',color:'#888888'};
export async function refresh(){state.data=await api(state.demo?'/api/demo':'/api/state');}
export async function save(collection,record){state.data=await api('/api/save',{revision:state.data.revision,collection,record});}
export async function remove(collection,id){state.data=await api('/api/delete',{revision:state.data.revision,collection,id});}
