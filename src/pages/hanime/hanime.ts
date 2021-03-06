import {Component, ViewChild} from '@angular/core';
import {IonicPage, ModalController, NavController, NavParams, ViewController} from 'ionic-angular';
import {HttpClient} from "@angular/common/http";
import videojs from 'video.js'
import {DomSanitizer, SafeUrl} from "@angular/platform-browser";

/**
 * Generated class for the HanimePage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

class VideoUnit {
  name: string;
  size: string;
  page: number | string;
  offset: number;
  end: number;
}

@IonicPage()
@Component({
  selector: 'page-hanime',
  templateUrl: 'hanime.html',
})
export class HanimePage {
  static LOCATE_FORMAT = (uri) => `http://118.89.141.135/debug/baidu_video.php?id=${uri}`;
  static HEAD_FORMAT = (page) => `http://118.89.141.135/animes/heads/${page}.head.json`;
  info = {};
  url: string | SafeUrl = null;
  page: number = 1;
  videoUnits: VideoUnit[] = [];

  constructor(public navCtrl: NavController, public navParams: NavParams, private http: HttpClient,public modalCtrl: ModalController) {
    this.loadPage(this.page).then((res:VideoUnit[])=>{
      res.forEach(value => {
        this.videoUnits.push(value);
      });
    });
  }

  loadPage(page:number):Promise<any>{
    return this.http.get(HanimePage.HEAD_FORMAT(page)).toPromise().then((res: any) => {
      console.log("Get Head:" + JSON.stringify(res));
      let offset = 0;
      let info = {};
      ////////////////////////计算打包文件头长度/////////////////////////////////////
      let headLen = 4;
      res.forEach(val => {
        headLen += 8 + val.file.length;
      });
      ////////////////////////通过包头长度、每个文件大小，计算当前文件offset和end位置/////////////////////////////////////
      let videoUnitsIn = [];
      res.forEach(val => {
        let name = val.file.split("/")[1];
        info[name] = {offset: offset + headLen, end: offset + val.size + headLen};
        videoUnitsIn.push({
          name: name,
          size: val.size,
          page: page,
          offset: offset + headLen,
          end: offset + val.size + headLen
        });
        offset += val.size;
      });
      this.info = info;
      return new Promise((resolve, reject)=>{
        resolve(videoUnitsIn)
      })
    })
  }
  openVideo(unit:VideoUnit){
    let modal = this.modalCtrl.create(VideoModal, {video:unit});
    alert(JSON.stringify(unit));
    modal.present();
  }
  doNextPage(infiniteScroll) {
    this.page++;
    this.loadPage(this.page).then((res:VideoUnit[])=>{
      if(res.length==0){
        infiniteScroll.complete();
        infiniteScroll.enable(false);
      }else {
        res.forEach(value => {
          this.videoUnits.push(value);
        });
        infiniteScroll.complete();
      }
    })
  }
}

@Component({
  template: `
    <ion-header>{{video.name}}</ion-header>
    <ion-content>
      <p>视频功能处于测试阶段</p>
      <p>现阶段拖动进度条会出bug</p>
      <video id="videoPlayer" controls #myVideo>
        <source type="video/mp4" [src]="blob" />
      </video>
    </ion-content>
  `
})
export class VideoModal {
  @ViewChild('myVideo') myVideo;
  blob:SafeUrl = null;
  video:VideoUnit;
  buffer:Uint8Array = new Uint8Array(0);
  constructor(public params: NavParams, public viewCtrl: ViewController, public http: HttpClient, private sanitizer: DomSanitizer) {
    this.video = this.params.get("video");
    this.http.get(HanimePage.LOCATE_FORMAT(this.video.page)).toPromise().then((res:string[])=>{
      this.setupVideo(res[0]);
    })
  }
  setupVideo(resUrl:string){
    this.myVideo.nativeElement.addEventListener('error',()=>{
      let currentTime = this.myVideo.nativeElement.currentTime;
      this.myVideo.nativeElement.load();
      this.myVideo.nativeElement.currentTime = currentTime;
      this.myVideo.nativeElement.play();
    });
    let offset = this.video.offset;
    let stepLength = 6*1024*1024;
    let end = offset + stepLength;
    let lambda = (val)=>{
      if(val!=null){
        this.buffer = this.concat(this.buffer,new Uint8Array(val));
        let file = new Blob([this.buffer],{type:'video/mp4'})
        this.blob = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(file));
        offset = end + 1;
        end = offset + stepLength<this.video.end?offset+stepLength:this.video.end;
        if(this.myVideo.nativeElement.currentTime==0){
          this.myVideo.nativeElement.load();
          this.myVideo.nativeElement.play();
          this.resize();
        }
      }
      if(offset!=end)
        this.http.get(resUrl,{responseType:'arraybuffer',headers:{'Range':`bytes=${offset}-${end}`}}).toPromise().then(lambda);
    };
    lambda(null);
  }

  concat(a:Uint8Array,b:Uint8Array):Uint8Array{
    let c = new Uint8Array(a.length+b.length);
    c.set(a,0);
    c.set(b,a.length);
    return c;
  }

  resize() {
    let video = this.myVideo.nativeElement;
    let videoRatio = video.height / video.width;
    let windowRatio = window.innerHeight / window.innerWidth; /* browser size */
    if (windowRatio < videoRatio) {
      if (window.innerHeight > 50) { /* smallest video height */
        video.height = window.innerHeight;
      } else {
        video.height = 50;
      }
    } else {
      video.width = window.innerWidth;
    }
  }
}
