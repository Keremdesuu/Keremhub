package com.keremhub.app;

import android.content.Context;
import android.graphics.*;
import android.view.View;

/** Native Canvas adaptation of the portal's original AppIcon vector artwork. */
final class ServiceIcon extends View {
    private final String kind;private final int color;private final Paint p=new Paint(3);
    ServiceIcon(Context context,String kind,int color){super(context);this.kind=kind;this.color=color;setLayerType(View.LAYER_TYPE_SOFTWARE,null);}
    private void fill(int color){p.reset();p.setAntiAlias(true);p.setColor(color);}
    private void rect(Canvas c,float l,float t,float r,float b,float radius,int color){fill(color);c.drawRoundRect(l,t,r,b,radius,radius,p);}
    private void path(Canvas c,int color,float... points){fill(color);Path path=new Path();path.moveTo(points[0],points[1]);for(int i=2;i<points.length;i+=2)path.lineTo(points[i],points[i+1]);path.close();c.drawPath(path,p);}
    @Override protected void onDraw(Canvas c){super.onDraw(c);c.save();c.scale(getWidth()/128f,getHeight()/128f);boolean film=kind.contains("flix"),book=kind.contains("kitabevi"),gallery=kind.contains("xxx");int[] colors=film?new int[]{0xffff5e70,0xffdb1839,0xff790e28}:book?new int[]{0xffffc66d,0xffee8c28,0xffb95722}:gallery?new int[]{0xffcfb4ff,0xff8460dc,0xff43318e}:new int[]{color,color,0xff17223f};fill(color);p.setShadowLayer(4,0,3,0x55000000);p.setShader(new LinearGradient(20,4,108,128,colors,new float[]{0,.52f,1},Shader.TileMode.CLAMP));c.drawRoundRect(4,4,124,124,28,28,p);fill(Color.WHITE);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(2);p.setShader(new LinearGradient(0,5,0,123,new int[]{0xaaffffff,0x00ffffff,0x33000000},null,Shader.TileMode.CLAMP));c.drawRoundRect(5,5,123,123,27,27,p);
        if(film){rect(c,23,31,105,98,15,0xff241d32);fill(0xffffb2c0);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(2);c.drawRoundRect(23,31,105,98,15,15,p);path(c,0xfffff4ed,53,48,81,65,53,83);for(int y=40;y<90;y+=14){rect(c,28,y,33,y+7,1.5f,0xfff9879d);rect(c,95,y,100,y+7,1.5f,0xfff9879d);}}
        else if(book){path(c,0xff9d461a,24,33,42,30,64,37,83,29,104,33,104,95,85,92,64,98,43,92,24,95);path(c,0xfffff3dc,25,28,43,27,64,34,64,92,45,84,25,87);path(c,0xfffff9e9,103,28,84,27,64,34,64,92,84,84,103,87);fill(0xffbb9c71);p.setStrokeWidth(2.5f);p.setStrokeCap(Paint.Cap.ROUND);for(int y=44;y<70;y+=12){c.drawLine(34,y,54,y+4,p);c.drawLine(74,y+4,94,y,p);}path(c,0xffe65f46,82,29,82,56,88,52,94,54,94,28);}
        else if(gallery){c.save();c.rotate(-12,26,25);rect(c,26,25,96,99,10,0xffdfd0ff);c.restore();c.save();c.rotate(7,31,29);rect(c,31,29,103,103,10,0xfffff9ef);rect(c,38,39,96,92,2,0xffe7ab65);fill(0xfffff2b8);c.drawCircle(80,51,8,p);path(c,0xff7361ab,38,88,58,56,72,76,82,68,96,92);path(c,0xff49416f,38,88,56,69,72,92);c.restore();}
        else{rect(c,25,34,103,94,10,0xffeaf0ff);rect(c,25,28,61,48,6,0xffeaf0ff);rect(c,30,46,98,91,7,0xffa7bcff);fill(0xff4168e8);p.setStrokeWidth(3);c.drawLine(42,69,86,69,p);c.drawLine(42,78,72,78,p);}
        c.restore();}
}
