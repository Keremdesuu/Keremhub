export function needsMetadata(row:{metaStatus:string;posterUrl:string|null;backdropUrl:string|null;overview?:string|null},refetchMissing=false){
 if(row.metaStatus==="manual")return false;
 return row.metaStatus!=="ok"||!row.posterUrl||!row.backdropUrl||row.posterUrl===row.backdropUrl||(refetchMissing&&!row.overview);
}
