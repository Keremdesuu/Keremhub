package com.keremhub.app;

import android.content.*;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.*;

/** Read-only provider restricted to the app's explicit shared cache directory. */
public final class CacheProvider extends ContentProvider {
    public boolean onCreate(){return true;}
    private File file(Uri uri)throws FileNotFoundException{try{File root=new File(getContext().getCacheDir(),"shared").getCanonicalFile();File f=new File(root,uri.getLastPathSegment()).getCanonicalFile();if(!f.getParentFile().equals(root))throw new FileNotFoundException();return f;}catch(IOException e){throw new FileNotFoundException();}}
    public ParcelFileDescriptor openFile(Uri u,String mode)throws FileNotFoundException{if(!"r".equals(mode))throw new FileNotFoundException();return ParcelFileDescriptor.open(file(u),ParcelFileDescriptor.MODE_READ_ONLY);}
    public String getType(Uri u){String ext=android.webkit.MimeTypeMap.getFileExtensionFromUrl(u.toString());String type=android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);return type==null?"application/octet-stream":type;}
    public Cursor query(Uri u,String[] projection,String s,String[] args,String sort){try{File f=file(u);MatrixCursor c=new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE});c.addRow(new Object[]{f.getName(),f.length()});return c;}catch(Exception e){return null;}}
    public Uri insert(Uri u,ContentValues v){throw new UnsupportedOperationException();}public int delete(Uri u,String s,String[] a){throw new UnsupportedOperationException();}public int update(Uri u,ContentValues v,String s,String[] a){throw new UnsupportedOperationException();}
}
