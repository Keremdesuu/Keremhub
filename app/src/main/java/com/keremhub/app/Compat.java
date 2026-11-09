package com.keremhub.app;
import java.io.*;
/** Java APIs implemented explicitly to keep Android 8+ compatibility without library desugaring. */
final class Compat {
    static void copy(InputStream input,OutputStream output)throws IOException{byte[] data=new byte[32768];int count;while((count=input.read(data))!=-1)output.write(data,0,count);}
}
