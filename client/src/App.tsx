import { useState, useRef } from 'react';

const COUPLE_NAME = "Eason & Nancy";
const DAYS_TOGETHER = 146;
const ANNIVERSARY = "3.26";

const MUSIC_SRC = "";

const allPhotos = [
  "/photos/Weixin Image_20260818232529_3303_21.jpg",
  "/photos/Weixin Image_20260818232530_3304_21.jpg",
  "/photos/Weixin Image_20260818232532_3305_21.jpg",
  "/photos/Weixin Image_20260818232533_3306_21.jpg",
  "/photos/Weixin Image_20260818232535_3307_21.jpg",
  "/photos/Weixin Image_20260818232536_3308_21.jpg",
  "/photos/Weixin Image_20260818232537_3309_21.jpg",
  "/photos/Weixin Image_20260818232538_3310_21.jpg",
  "/photos/Weixin Image_20260818232541_3311_21.jpg",
  "/photos/Weixin Image_20260818232542_3312_21.jpg",
  "/photos/Weixin Image_20260818232543_3313_21.jpg",
  "/photos/Weixin Image_20260818232544_3314_21.jpg",
  "/photos/Weixin Image_20260818232546_3315_21.jpg",
  "/photos/Weixin Image_20260818232549_3316_21.jpg",
  "/photos/Weixin Image_20260818232556_3317_21.jpg",
  "/photos/Weixin Image_20260818232600_3318_21.jpg",
  "/photos/Weixin Image_20260818232608_3319_21.jpg",
  "/photos/Weixin Image_20260818232620_3320_21.jpg",
  "/photos/Weixin Image_20260818232622_3321_21.jpg",
  "/photos/Weixin Image_20260818232624_3322_21.jpg",
  "/photos/Weixin Image_20260818232633_3323_21.jpg",
  "/photos/Weixin Image_20260818232638_3324_21.jpg",
  "/photos/Weixin Image_20260818232641_3325_21.jpg",
  "/photos/Weixin Image_20260818232644_3326_21.jpg",
  "/photos/Weixin Image_20260818232651_3327_21.jpg",
  "/photos/Weixin Image_20260818232658_3328_21.jpg",
  "/photos/Weixin Image_20260818232703_3329_21.jpg",
  "/photos/Weixin Image_20260818232708_3330_21.jpg",
  "/photos/Weixin Image_20260818232709_3331_21.jpg",
  "/photos/Weixin Image_20260818232710_3332_21.jpg",
  "/photos/Weixin Image_20260818232712_3333_21.jpg",
  "/photos/Weixin Image_20260818232717_3334_21.jpg",
  "/photos/Weixin Image_20260818232719_3335_21.jpg",
  "/photos/Weixin Image_20260818232720_3336_21.jpg",
  "/photos/Weixin Image_20260818232726_3337_21.jpg",
  "/photos/Weixin Image_20260818232733_3338_21.jpg",
  "/photos/Weixin Image_20260818232742_3339_21.jpg",
  "/photos/Weixin Image_20260818232745_3340_21.jpg",
  "/photos/Weixin Image_20260818232754_3341_21.jpg",
  "/photos/Weixin Image_20260818232800_3342_21.jpg",
  "/photos/Weixin Image_20260818232803_3343_21.jpg",
  "/photos/Weixin Image_20260818232804_3344_21.jpg",
];

const row1 = allPhotos.slice(0, 14);
const row2 = allPhotos.slice(14, 28);
const row3 = allPhotos.slice(28);

const MESSAGE = `七夕快乐翻车鱼：

翻看相框，我总能找到很多属于我们的回忆，不论是远在美国乔治城的晚上，我拎着大袋的杂货，耳机中浮过你可爱的声音，还是松江的大森深夜食堂，我们开怀大笑，大快朵颐（是干饭搭子了hh）；抑或是密室里胆小的我，超c的你。这些回忆忘不了，也很高兴能继续和你一起，在接下来的大学时光，甚至是步入社会的日子里，继续开怀大笑，永远小孩子，永远热泪盈眶。

—— 武奕成 于新加坡 2026.8.18深夜`;

export default function App() {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    if (audioRef.current && !isPlaying) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="app">
      <audio ref={audioRef} src={MUSIC_SRC} loop />

      {/* Photo rows - behind the text */}
      <div className="photo-rows">
        <div className="photo-row">
          <div className="track">
            {[...row1, ...row1].map((src, i) => (
              <img key={i} src={src} alt="" />
            ))}
          </div>
        </div>
        <div className="photo-row">
          <div className="track reverse">
            {[...row2, ...row2].map((src, i) => (
              <img key={i} src={src} alt="" />
            ))}
          </div>
        </div>
        <div className="photo-row">
          <div className="track">
            {[...row3, ...row3].map((src, i) => (
              <img key={i} src={src} alt="" />
            ))}
          </div>
        </div>
      </div>

      {/* Flip card */}
      <div className={`flip-card ${isFlipped ? 'flipped' : ''}`} onClick={handleFlip}>
        <div className="flip-card-inner">
          {/* Front */}
          <div className="flip-card-front">
            <h1 className="title">{COUPLE_NAME}</h1>
            <div className="counter">
              <span className="days">{DAYS_TOGETHER}</span>
              <span className="label">days</span>
            </div>
            <p className="since">together since {ANNIVERSARY}</p>
            <div className="hearts">
              <span>♥</span>
              <span>♥</span>
              <span>♥</span>
            </div>
            <button className="music-btn">猜猜这里是啥 🎵</button>
          </div>

          {/* Back */}
          <div className="flip-card-back">
            <p className="message">{MESSAGE}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
