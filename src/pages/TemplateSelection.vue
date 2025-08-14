<template>
  <div id="parent" class="p-8">
    <h1 class="text-4xl uppercase whitespace-nowrap tracking-wider">Choose your template</h1>
    <div id="template-selection" class="grid grid-cols-4">
      <a class="self-center box" :class="{active: booth.selectedFrame?.id === 1}" @click=booth.setFrame(1,2)>
        <img src="/images/pose1_2.png" class="pb-template box__image"/>
      </a>
      <a class="self-center box" :class="{active: booth.selectedFrame?.id === 2}" @click=booth.setFrame(2,3)>
        <img src="/images/pose1_3.png" class="pb-template box__image"/>
      </a>
      <a class="self-center box" :class="{active: booth.selectedFrame?.id === 3}" @click=booth.setFrame(3,4)>
        <img src="/images/pose2_4.png" class="pb-template box__image"/>
      </a>
      <a class="self-center box" :class="{active: booth.selectedFrame?.id === 4}" @click=booth.setFrame(4,4)>
        <img src="/images/pose2_4v2.png" class="pb-template box__image"/>
      </a>
      
    </div>
    <router-link v-if="booth.selectedFrame" to="/camera" class="pb-button p-5">CLICK HERE TO PROCEED</router-link>
    <button v-if="!booth.selectedFrame" class="pb-button p-5 disabled">CLICK HERE TO PROCEED</button>
  </div>
</template>

<script setup>
import { usePhotoboothStore } from '../assets/js/data';
const booth = usePhotoboothStore();
</script>

<style scoped>
#template-selection {
  column-gap: 3rem;
}
.box {
  display: inline-block;
  float: left;
  width: 200px;
  height: 200px;
  position: relative;
  border: 1px solid #e5e5e5;
  z-index: 0;
  opacity: 1;
  margin-right: -1px;
  cursor: pointer;
}
.box:hover, .box.active {
  z-index: 10;
  border-color: #000;
}
.box:before, .box:after {
  content: "";
  display: block;
  position: absolute;
  background: #e5e5e5;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation-iteration-count: 1;
  transform-origin: 50% 50%;
  opacity: 1;
}
.box:before {
  width: calc(100% + 2px);
  height: 100%;
  z-index: 1;
  transition: height 1s ease, opacity 0.8s ease;
}
.box:after {
  height: calc(100% + 2px);
  width: 100%;
  z-index: 1;
  transition: width 1s ease, opacity 0.8s ease;
}
.box:hover:before, .box.active:before {
  transition: height 0.2s ease, opacity 0.3s ease;
  height: 85%;
  opacity: 0.7;
}
.box:hover:after, .box.active:after {
  transition: width 0.2s ease, opacity 0.3s ease;
  width: 85%;
  opacity: 0.8;
}
.box.active:before, .box.active:after {
  background: #a5a5a5;
  transition: 0.5s;
  height: 100%;
  width: 100%;
  transition: 0.15s;
}
.box__image {
  fill: #000;
  width: auto;
  will-change: width;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(1);
  transition: all 0.5s ease;
  z-index: 2;
}
</style>