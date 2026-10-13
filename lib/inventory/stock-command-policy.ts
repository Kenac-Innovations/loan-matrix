export function stockCommand(endpoint:string,method='GET'):{loanId:number;command:string}|null {
 const url=new URL(endpoint,'http://internal');const match=/^\/loans\/(\d+)\/?$/.exec(url.pathname);
 if(!match)return null;
 const verb=method.toUpperCase();const command=verb==='POST'?url.searchParams.get('command'):verb==='PUT'?'update':verb==='DELETE'?'delete':null;
 return command&&['approve','disburse','reject','undoapproval','undodisbursal','withdrawnbyapplicant','update','delete'].includes(command)?{loanId:Number(match[1]),command}:null;
}
