import * as THREE from 'three';

const EPS=1e-12;
const G0=9.80665;

function finite(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}

export class OrbitalMechanics{
  static muFromSurfaceGravity(radiusM,gravityMS2=G0){const r=Math.max(EPS,finite(radiusM,1));return Math.max(EPS,finite(gravityMS2,G0))*r*r}
  static gravityAcceleration(positionM,mu){const r=positionM.length();if(r<EPS)return new THREE.Vector3();return positionM.clone().multiplyScalar(-Math.max(EPS,finite(mu,1))/(r*r*r))}
  static circularVelocity(radiusM,mu){const r=Math.max(EPS,finite(radiusM,1));return Math.sqrt(Math.max(0,finite(mu,0)/r))}
  static escapeVelocity(radiusM,mu){return Math.sqrt(2)*this.circularVelocity(radiusM,mu)}
  static specificOrbitalEnergy(positionM,velocityMS,mu){const r=Math.max(EPS,positionM.length());return .5*velocityMS.lengthSq()-finite(mu,0)/r}
  static semiMajorAxis(positionM,velocityMS,mu){const e=this.specificOrbitalEnergy(positionM,velocityMS,mu);if(Math.abs(e)<EPS)return Infinity;return -finite(mu,0)/(2*e)}
  static tangentAt(positionM,preferred=null){const r=positionM.clone().normalize();let seed=preferred&&preferred.lengthSq()>EPS?preferred.clone():new THREE.Vector3(0,1,0);seed.addScaledVector(r,-seed.dot(r));if(seed.lengthSq()<EPS){seed=Math.abs(r.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);seed.addScaledVector(r,-seed.dot(r))}return seed.normalize()}
  static elementsFromState(positionM,velocityMS,mu){
    const rVec=positionM.clone(),vVec=velocityMS.clone(),r=rVec.length(),v=vVec.length(),muN=Math.max(EPS,finite(mu,1));
    if(r<EPS)return{radiusM:0,speedMS:v,altitudeM:0,semiMajorAxisM:0,eccentricity:0,periodSec:0,specificEnergy:0};
    const hVec=new THREE.Vector3().crossVectors(rVec,vVec),h=hVec.length();
    const eVec=new THREE.Vector3().crossVectors(vVec,hVec).multiplyScalar(1/muN).sub(rVec.clone().multiplyScalar(1/r));
    const ecc=eVec.length(),energy=.5*v*v-muN/r,a=Math.abs(energy)<EPS?Infinity:-muN/(2*energy);
    const period=Number.isFinite(a)&&a>0?2*Math.PI*Math.sqrt(a*a*a/muN):Infinity;
    return{radiusM:r,speedMS:v,semiMajorAxisM:a,eccentricity:ecc,periodSec:period,specificEnergy:energy,angularMomentum:h};
  }
  static integrate(positionM,velocityMS,dt,mu,extraAcceleration=null){
    const step=clamp(finite(dt,.016),0,.25);let a=this.gravityAcceleration(positionM,mu);if(extraAcceleration)a.add(extraAcceleration);velocityMS.addScaledVector(a,step);positionM.addScaledVector(velocityMS,step);return{positionM,velocityMS,accelerationMS2:a}
  }
  static rocketFuelForDeltaV(deltaVMS,dryMassKg,fuelKg,ispSec){
    const dv=Math.max(0,Math.abs(finite(deltaVMS,0))),dry=Math.max(.001,finite(dryMassKg,1)),fuel=Math.max(0,finite(fuelKg,0)),isp=Math.max(1,finite(ispSec,300)),m0=dry+fuel;
    if(dv<=0||fuel<=0)return 0;const m1=m0/Math.exp(dv/(isp*G0));return clamp(m0-m1,0,fuel)
  }
  static availableDeltaV(dryMassKg,fuelKg,ispSec){const dry=Math.max(.001,finite(dryMassKg,1)),fuel=Math.max(0,finite(fuelKg,0)),isp=Math.max(1,finite(ispSec,300));return isp*G0*Math.log((dry+fuel)/dry)}
  static hohmann(mu,r1M,r2M){
    const m=Math.max(EPS,finite(mu,1)),r1=Math.max(EPS,finite(r1M,1)),r2=Math.max(EPS,finite(r2M,1)),a=(r1+r2)/2;
    const v1=Math.sqrt(m/r1),v2=Math.sqrt(m/r2),vt1=Math.sqrt(m*(2/r1-1/a)),vt2=Math.sqrt(m*(2/r2-1/a));
    const dv1=vt1-v1,dv2=v2-vt2,timeSec=Math.PI*Math.sqrt(a*a*a/m);
    return{r1M:r1,r2M:r2,transferSemiMajorAxisM:a,deltaV1MS:dv1,deltaV2MS:dv2,totalDeltaVMS:Math.abs(dv1)+Math.abs(dv2),timeSec};
  }
}

export const STANDARD_GRAVITY=G0;
