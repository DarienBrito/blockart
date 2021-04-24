import React, { useEffect } from "react";
import { Shaders, Node, GLSL } from "gl-react";
import MersenneTwister from "mersenne-twister";

/*
Create your Custom style to be turned into a EthBlock.art Mother NFT

Basic rules:
 - use a minimum of 1 and a maximum of 4 "modifiers", modifiers are values between 0 and 1,
 - use a minimum of 1 and a maximum of 3 colors, the color "background" will be set at the canvas root
 - Use the block as source of entropy, no Math.random() allowed!
 - You can use a "shuffle bag" using data from the block as seed, a MersenneTwister library is provided

 Arguments:
  - block: the blockData, in this example template you are given 3 different blocks to experiment with variations, check App.js to learn more
  - mod[1-3]: template modifier arguments with arbitrary defaults to get your started
  - color: template color argument with arbitrary default to get you started

Getting started:
 - Write gl-react code, comsuming the block data and modifier arguments,
   make it cool and use no random() internally, component must be pure, output deterministic
 - Customize the list of arguments as you wish, given the rules listed below
 - Provide a set of initial /default values for the implemented arguments, your preset.
 - Think about easter eggs / rare attributes, display something different every 100 blocks? display something unique with 1% chance?

 - check out https://gl-react-cookbook.surge.sh/ for examples!
*/

var shape;

export const styleMetadata = {
  name: "Fractional space",
  description:
    "Explore kelidoscopic patterns generated from fractional numbers. Block data determines the detail of the fractions and used geometry, the rest is up for discovery.",
  image: "",
  creator_name: "Darien",
  options: {
    mod1: 0.5, // speed
    mod2: 0.5, // zoom
    mod3: 0.5, // fract scaler
    mod4: 0.01, // hue offset start
    mod5: 0.01, // hue offset end
    mod6: 0.028, // sin freq for map
    mod7: 0.01 // roundness
  }
};

const shaders = Shaders.create({
  main: {
    frag: GLSL`
precision highp float;
varying vec2 uv;

uniform float seedA;
uniform float seedB;
uniform float seedC;
uniform float time;
uniform float mod1;
uniform float mod2;
uniform float mod3;
uniform float mod4;
uniform float mod5;
uniform float mod6;
uniform float mod7;
uniform vec2 resolution;

#define PI 3.141592653589
#define TAU 6.28318530718
#define STEPS 64

// Shapes
float sphere(vec3 p) {
  return length(p);
}

// SDF's by IQ
float sdRoundBox( vec3 p, vec3 b, float r ) {
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
}

float sdOctahedron( vec3 p, float s) {
  p = abs(p);
  return (p.x+p.y+p.z-s)*0.57735027;
}

float sdBoxFrame( vec3 p, vec3 b, float e ) {
  p = abs(p)-b;
  vec3 q = abs(p+e)-e;
  return min(min(
      length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
      length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
      length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
}

mat2 rotateMat(float a) {
  vec2 v = vec2(cos(a), sin(a));
  return mat2(v.x, -v.y, v.y, v.x); 
}

vec2 rotate(vec2 uv, float a) {
  return rotateMat(a) * uv;
}

float map(vec3 p) {
  float density = mod3;
  vec3 xyz = (fract(p * density) * 2.0 - 1.0); 
  
  float s = seedB;
  float c;

  if(s <= 0.25) {
    c = sphere(xyz);
  } else if(s <= 0.5) {
    c = sdRoundBox(xyz, vec3(0.1), 0.05);
  } else if (s <= 0.75) {
    c = sdOctahedron(xyz, 0.25);
  } else {
    c = sdBoxFrame(xyz, vec3(0.25), 0.025);
  }

  return c - mod7*0.75;
}

vec3 getNormal(vec3 p)
{
  vec3 delta = vec3(0.01, 0.0, 0.0);
    return normalize(vec3(map(p+delta.xyy) - map(p-delta.xyy),
                          map(p+delta.yxy) - map(p-delta.yxy),
                          map(p+delta.yyx) - map(p-delta.yyx)));
}

float trace(vec3 o, vec3 r) {
  float totalDist = 0.0;
  for (int i = 0; i < STEPS; ++i) {
      vec3 p = o + r * totalDist;
      float d = map(p);
      totalDist += d * seedA;
  }
  return totalDist;
}

vec3 rayDir(float fov, vec2 coords, vec2 res) {
  float q = float(int(seedC * 4.0)) / 4.0;
  vec2 xy = rotate(coords - (res * 0.5), q * PI);
  float z = res.y / tan(radians(fov) * 0.5);
  return normalize(vec3(xy, z));
}

// YIQ color rotation/hue shift
vec3 hueShiftYIQ(vec3 rgb, float h) {
  float a = h * -TAU;
  const mat3 rgb2yiq = mat3(  0.299, 0.596, 0.211,
                0.587, -0.274, -0.523,
                0.114, -0.322, 0.312);
  const mat3 yiq2rgb = mat3(  1, 1, 1,
                0.956, -0.272, -1.106,
                0.621, -0.647, 1.703);
  vec3 yiq = rgb2yiq * rgb;
  yiq.yz = rotate(yiq.yz, a);
  return yiq2rgb * yiq;
}

void main() {
  vec3 o  = vec3(0.0, 0.0, time*mod1 +  PI * 2.0);
  vec3 r  = rayDir(max(0.01, min(0.99, mod2)) * 180.0, uv*resolution, resolution);
  float d = trace(o, r);

  vec3 pos = o + r * d;
  float fd = map(pos);
  vec3 normal = getNormal(pos);
  
  float diffusion = max(dot(r, -normal), 0.0);
  float fog = diffusion * 8.0 / d * 2.0 + fd - 0.5; 
  
  // Color basis
  vec3 sc = vec3(0.1, 0.3, 0.8);
  vec3 ec = vec3(0.8, 0.1, 0.1);

  // User coloring
  sc = hueShiftYIQ(sc, mod4);
  ec = hueShiftYIQ(ec, mod5);
  vec3 fc  = mix(sc, ec, sin(TAU * fd * (mod6 * 6.0)));

  fc *= fog;
  gl_FragColor = vec4(sqrt(fc),1.0);

}
  `
  }
});

const CustomStyle = ({
  block,
  attributesRef,
  time,
  width,
  height,
  mod1,
  mod2,
  mod3,
  mod4,
  mod5,
  mod6,
  mod7
}) => {
  useAttributes(attributesRef);

  const { hash } = block;

  const rng = new MersenneTwister(parseInt(hash.slice(0, 16), 16));

  // Testing seeds...
  // let r = rng.random();
  // r = rng.random();
  // console.log(r)
  let s1 = rng.random();
  let s2 = rng.random();
  let s3 = rng.random();

  if (s2 <= 0.25) {
    shape = "sphere";
  } else if (s2 <= 0.5) {
    shape = "cube";
  } else if (s2 <= 0.75) {
    shape = "octaedron";
  } else {
    shape = "hollow cube";
  }

  return (
    <Node
      shader={shaders.main}
      uniforms={{
        time,
        mod1,
        mod2,
        mod3,
        mod4,
        mod5,
        mod6,
        mod7,
        seedA: s1,
        seedB: s2,
        seedC: s3,
        resolution: [width, height]
      }}
    />
  );
};

function useAttributes(ref) {
  // Update custom attributes related to style when the modifiers change
  useEffect(() => {
    ref.current = () => {
      return {
        // This is called when the final image is generated, when creator opens the Mint NFT modal.
        // should return an object structured following opensea/enjin metadata spec for attributes/properties
        // https://docs.opensea.io/docs/metadata-standards
        // https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1155.md#erc-1155-metadata-uri-json-schema

        attributes: [
          {
            trait_type: "Basis primitive",
            value: shape
          }
        ]
      };
    };
  }, [ref]);
}

export default CustomStyle;
