package com.keremhub.app;

import android.content.res.ColorStateList;
import android.graphics.*;
import android.graphics.drawable.*;
import android.view.*;
import android.widget.*;
import java.util.function.IntConsumer;

/** Shared native primitives matching the source sites' line icons and compact navigation. */
public final class Ui {
    private Ui(){}
    public static View icon(MainActivity a,String name,int size,int color,Runnable click){
        Icon view=new Icon(a,name,color);view.setLayoutParams(new LinearLayout.LayoutParams(a.dp(size),a.dp(size)));view.setContentDescription(name);
        if(click!=null){view.setBackground(new RippleDrawable(ColorStateList.valueOf(0x22808080),null,a.shape(-1,40)));view.setOnClickListener(v->click.run());view.setFocusable(true);}return view;
    }
    public static void line(MainActivity a,LinearLayout parent,int color){View v=new View(a);v.setBackgroundColor(color);parent.addView(v,new LinearLayout.LayoutParams(-1,a.dp(1)));}
    public static GradientDrawable border(MainActivity a,int fill,int stroke,int radius){GradientDrawable d=a.shape(fill,radius);d.setStroke(a.dp(1),stroke);return d;}
    public static LinearLayout fixedHeader(MainActivity a){a.root.getChildAt(0).setVisibility(View.GONE);LinearLayout header=a.column();header.setBackgroundColor(a.bg);a.root.addView(header,0,new LinearLayout.LayoutParams(-1,-2));return header;}
    public static void tabs(MainActivity a,LinearLayout host,String[] labels,int selected,int selectedColor,int otherColor,IntConsumer action){
        HorizontalScrollView scroll=new HorizontalScrollView(a);scroll.setHorizontalScrollBarEnabled(false);scroll.setFillViewport(true);LinearLayout row=a.row();row.setPadding(a.dp(16),0,a.dp(16),0);
        for(int i=0;i<labels.length;i++){final int index=i;LinearLayout tab=a.column();TextView text=a.text(labels[i],14,i==selected?selectedColor:otherColor);text.setTypeface(a.font("inter",i==selected?600:400));text.setGravity(Gravity.CENTER);tab.addView(text,new LinearLayout.LayoutParams(-2,a.dp(46)));View indicator=new View(a);indicator.setBackgroundColor(i==selected?a.accent:Color.TRANSPARENT);LinearLayout.LayoutParams line=new LinearLayout.LayoutParams(-1,a.dp(2));tab.addView(indicator,line);LinearLayout.LayoutParams tabParams=new LinearLayout.LayoutParams(-2,-2);tabParams.setMargins(0,0,i<labels.length-1?a.dp(20):0,0);row.addView(tab,tabParams);tab.setOnClickListener(v->action.accept(index));}
        scroll.addView(row);host.addView(scroll,new LinearLayout.LayoutParams(-1,-2));if(selected>=0)scroll.post(()->{View v=row.getChildAt(selected);if(v!=null)scroll.smoothScrollTo(Math.max(0,v.getLeft()-a.dp(20)),0);});
    }
    public static final class Icon extends View {
        private final String name;private final Paint p=new Paint(3);private final int color;private final MainActivity a;
        public Icon(MainActivity a,String name,int color){super(a);this.a=a;this.name=name;this.color=color;}
        private void path(Canvas c,float... values){Path x=new Path();x.moveTo(values[0],values[1]);for(int i=2;i<values.length;i+=2)x.lineTo(values[i],values[i+1]);c.drawPath(x,p);}
        private void rect(Canvas c,float x,float y,float w,float h,float r){c.drawRoundRect(x,y,x+w,y+h,r,r,p);}
        @Override protected void onDraw(Canvas c){super.onDraw(c);float side=Math.min(getWidth(),getHeight());float glyph=Math.min(a.dp(24),side*.7f);c.save();c.translate((getWidth()-glyph)/2,(getHeight()-glyph)/2);c.scale(glyph/24,glyph/24);p.setColor(color);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(1.7f);p.setStrokeCap(Paint.Cap.ROUND);p.setStrokeJoin(Paint.Join.ROUND);
            switch(name){
                case "search":c.drawCircle(10.5f,10.5f,6.5f,p);path(c,15.5f,15.5f,21,21);break;
                case "home":path(c,3,10,12,3,21,10,21,21,15,21,15,14,9,14,9,21,3,21,3,10);break;
                case "back":path(c,15,4,7,12,15,20);break;
                case "bell":path(c,4,17,6,14,6,9);c.drawArc(6,3,18,15,180,180,false,p);path(c,18,9,18,14,20,17,4,17);c.drawArc(9,17,15,22,0,180,false,p);break;
                case "refresh":c.drawArc(4,4,20,20,35,285,false,p);path(c,20,4,20,10,14,10);break;
                case "grid":for(int y=3;y<=13;y+=10)for(int x=3;x<=13;x+=10)rect(c,x,y,7,7,1);break;
                case "list":for(int y=5;y<=19;y+=7){path(c,3,y,4,y);path(c,8,y,21,y);}break;
                case "books":rect(c,3,4,4,16,1);rect(c,10,4,4,16,1);c.save();c.rotate(-12,19,20);rect(c,17,6,4,14,1);c.restore();break;
                case "bookmark":path(c,5,3,19,3,19,21,12,16,5,21,5,3);path(c,8,8,11,11,16,6);break;
                case "upload":path(c,12,16,12,3,7,8);path(c,12,3,17,8);path(c,4,14,4,21,20,21,20,14);break;
                case "download":path(c,12,3,12,16,7,11);path(c,12,16,17,11);path(c,4,16,4,21,20,21,20,16);break;
                case "folder":path(c,2,7,2,20,22,20,22,6,12,6,9,3,2,3,2,7);break;
                case "trash":path(c,3,6,21,6);path(c,9,6,9,3,15,3,15,6);path(c,5,6,6,21,18,21,19,6);path(c,10,10,10,17);path(c,14,10,14,17);break;
                case "moon":c.drawArc(3,3,22,22,40,280,false,p);c.drawArc(10,0,25,15,90,135,false,p);break;
                case "sun":c.drawCircle(12,12,4,p);for(int k=0;k<8;k++){c.save();c.rotate(45*k,12,12);path(c,12,1,12,3);c.restore();}break;
                case "plus":path(c,12,4,12,20);path(c,4,12,20,12);break;
                case "check":path(c,4,12,9,17,20,6);break;
                case "close":path(c,5,5,19,19);path(c,19,5,5,19);break;
                case "info":c.drawCircle(12,12,9,p);path(c,12,11,12,17);c.drawPoint(12,7,p);break;
                case "more":p.setStyle(Paint.Style.FILL);for(int x=5;x<=19;x+=7)c.drawCircle(x,12,1.4f,p);break;
                case "filter":path(c,3,5,21,5);path(c,6,12,18,12);path(c,10,19,14,19);break;
                case "scan":path(c,3,8,3,3,8,3);path(c,16,3,21,3,21,8);path(c,21,16,21,21,16,21);path(c,8,21,3,21,3,16);path(c,7,12,17,12);break;
                case "video":rect(c,3,8,18,13,2);path(c,3,8,2,4,19,1,21,6,3,9);path(c,8,3,12,7);path(c,15,2,19,6);break;
                case "photo":rect(c,6,3,16,16,2);path(c,2,7,2,22,18,22);c.drawCircle(17,7,1.2f,p);path(c,7,16,12,10,17,16,21,12);break;
                case "users":c.drawCircle(9,7,4,p);c.drawArc(2,13,16,27,180,180,false,p);c.drawArc(13,3,21,11,-90,180,false,p);c.drawArc(15,13,23,25,180,150,false,p);break;
                case "cloud":path(c,7,19,18,19);c.drawArc(13,9,23,19,-90,180,false,p);c.drawArc(4,3,18,17,180,210,false,p);c.drawArc(1,10,11,20,90,180,false,p);break;
                case "drive":path(c,5,4,19,4,22,13,22,20,2,20,2,13,5,4);path(c,2,13,22,13);c.drawPoint(17,17,p);break;
                case "up":path(c,12,21,12,3,5,10);path(c,12,3,19,10);break;
                case "shuffle":path(c,3,5,7,5,17,19,21,19);path(c,17,15,21,19,17,23);path(c,3,19,7,19,17,5,21,5);path(c,17,1,21,5,17,9);break;
                case "play":p.setStyle(Paint.Style.FILL);Path play=new Path();play.moveTo(7,3);play.lineTo(21,12);play.lineTo(7,21);play.close();c.drawPath(play,p);break;
                default:rect(c,4,4,16,16,3);break;
            }c.restore();
        }
    }
}
