use glam::{EulerRot, Quat, Vec2, Vec3};

use crate::spring::Spring;

pub const CAM_FLOATS: usize = 20;
pub const MAJOR_STEP: f32 = 4.0;
pub const FLOOR_Y: f32 = -1.55;
pub const TAN_HALF_FOV: f32 = 0.58;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum LightState {
    Hidden,
    Cursor,
    ToObject,
    LockedObject,
    ToCursor,
}

pub struct GridCamera {
    cam_x: Spring,
    cam_y: Spring,
    cam_yaw: Spring,
    cam_pitch: Spring,
    cam_roll: Spring,
    cam_pos: Vec3,
    cam_forward: Vec3,
    cam_right: Vec3,
    cam_up: Vec3,
    light_state: LightState,
    has_floor_pos: bool,
    free_xz: Vec2,
    anchor_xz: Vec2,
    anchor_blend: Spring,
    cursor_glow: Spring,
    scroll_z: f32,
    cam_buf: [f32; CAM_FLOATS],
}

impl GridCamera {
    pub const fn new() -> Self {
        Self {
            cam_x: Spring::new(0.0),
            cam_y: Spring::new(0.0),
            cam_yaw: Spring::new(0.0),
            cam_pitch: Spring::new(-0.14),
            cam_roll: Spring::new(0.0),
            cam_pos: Vec3::ZERO,
            cam_forward: Vec3::Z,
            cam_right: Vec3::X,
            cam_up: Vec3::Y,
            light_state: LightState::Hidden,
            has_floor_pos: false,
            free_xz: Vec2::new(0.0, 8.0),
            anchor_xz: Vec2::new(0.0, 4.35),
            anchor_blend: Spring::new(0.0),
            cursor_glow: Spring::new(0.0),
            scroll_z: 0.0,
            cam_buf: [0.0; CAM_FLOATS],
        }
    }

    pub fn basis_from_angles(
        yaw: f32,
        pitch: f32,
        roll: f32,
    ) -> (Vec3, Vec3, Vec3) {
        let rot = Quat::from_euler(EulerRot::YXZ, yaw, -pitch, roll);
        (rot * Vec3::X, rot * Vec3::Y, rot * Vec3::Z)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn step_camera(
        &mut self,
        safe_dt: f32,
        motion_scale: f32,
        time: f32,
        size: Vec2,
        mouse: Vec2,
        pointer_active: bool,
        snap: bool,
    ) {
        let safe_size = size.max(Vec2::ONE);
        let mobile_mix = ((900.0 - safe_size.x) / 300.0).clamp(0.0, 1.0);

        let sway_amp_x = 0.06 + mobile_mix * 0.42;
        let sway_amp_y = 0.025 + mobile_mix * 0.035;
        let sway_freq = 0.32 + mobile_mix * 0.16;

        let primary_x = (time * sway_freq).sin();
        let harmonic_x = (time * sway_freq * 0.53 + 1.1).sin() * 0.20;
        let idle_sway_x =
            (primary_x + harmonic_x) * (sway_amp_x / 1.20) * motion_scale;
        let idle_sway_y = (time * 0.26).cos() * sway_amp_y * motion_scale;

        let norm = if pointer_active {
            (((mouse / safe_size) - Vec2::splat(0.5)) * 2.0)
                .clamp(Vec2::NEG_ONE, Vec2::ONE)
        } else {
            Vec2::new(idle_sway_x, idle_sway_y)
        };

        let dolly_x = 0.52 + mobile_mix * 0.48;
        let yaw_gain = 0.082 - mobile_mix * 0.140;
        let roll_gain = 0.018 + mobile_mix * 0.008;

        self.cam_x.target = norm.x * dolly_x;
        self.cam_y.target = -norm.y * 0.20;
        self.cam_yaw.target = norm.x * yaw_gain;
        self.cam_pitch.target = -0.14 - norm.y * 0.052;
        self.cam_roll.target = -norm.x * roll_gain;

        if snap {
            self.cam_x.snap(self.cam_x.target);
            self.cam_y.snap(self.cam_y.target);
            self.cam_yaw.snap(self.cam_yaw.target);
            self.cam_pitch.snap(self.cam_pitch.target);
            self.cam_roll.snap(self.cam_roll.target);
            self.light_state = LightState::Hidden;
            self.has_floor_pos = false;
            self.anchor_blend.snap(0.0);
            self.cursor_glow.snap(0.0);
        } else if pointer_active {
            self.cam_x.step(safe_dt, 62.0, 15.7);
            self.cam_y.step(safe_dt, 62.0, 15.7);
            self.cam_yaw.step(safe_dt, 58.0, 15.2);
            self.cam_pitch.step(safe_dt, 58.0, 15.2);
            self.cam_roll.step(safe_dt, 52.0, 14.4);
        } else {
            self.cam_x.step(safe_dt, 24.0, 9.8);
            self.cam_y.step(safe_dt, 24.0, 9.8);
            self.cam_yaw.step(safe_dt, 22.0, 9.4);
            self.cam_pitch.step(safe_dt, 22.0, 9.4);
            self.cam_roll.step(safe_dt, 20.0, 8.9);
        }

        let travel = safe_dt * 0.85 * motion_scale;
        self.scroll_z = (self.scroll_z + travel).rem_euclid(MAJOR_STEP);

        let (right, up, forward) = Self::basis_from_angles(
            self.cam_yaw.pos,
            self.cam_pitch.pos,
            self.cam_roll.pos,
        );
        self.cam_pos = Vec3::new(self.cam_x.pos, self.cam_y.pos, 0.0);
        self.cam_right = right;
        self.cam_up = up;
        self.cam_forward = forward;

        self.cam_buf[0] = self.cam_pos.x;
        self.cam_buf[1] = self.cam_pos.y;
        self.cam_buf[2] = self.cam_pos.z;
        self.cam_buf[3] = TAN_HALF_FOV;

        self.cam_buf[4] = forward.x;
        self.cam_buf[5] = forward.y;
        self.cam_buf[6] = forward.z;
        self.cam_buf[7] = self.scroll_z;

        self.cam_buf[8] = right.x;
        self.cam_buf[9] = right.y;
        self.cam_buf[10] = right.z;
        self.cam_buf[11] = FLOOR_Y;

        self.cam_buf[12] = up.x;
        self.cam_buf[13] = up.y;
        self.cam_buf[14] = up.z;
        self.cam_buf[15] = 0.0;
    }

    pub fn step_cursor_light(
        &mut self,
        safe_dt: f32,
        size: Vec2,
        mouse: Vec2,
        pointer_active: bool,
        hovered_anchor: Option<Vec2>,
        snap: bool,
    ) {
        let safe_size = size.max(Vec2::ONE);

        let mut ray_hits_floor = false;
        let mut ray_hit_xz = self.free_xz;

        if pointer_active {
            let half_h = (safe_size.y * 0.5).max(1.0);
            let us = ((mouse.x - safe_size.x * 0.5) / half_h) * TAN_HALF_FOV;
            let vs = ((safe_size.y * 0.5 - mouse.y) / half_h) * TAN_HALF_FOV;

            let ray =
                self.cam_forward + self.cam_right * us + self.cam_up * vs;
            let dir = ray.try_normalize().unwrap_or(self.cam_forward);

            if dir.y < -0.025 {
                ray_hits_floor = true;
                let t = ((FLOOR_Y - self.cam_pos.y) / dir.y).clamp(0.1, 42.0);
                let hit = self.cam_pos + dir * t;
                ray_hit_xz = Vec2::new(hit.x, hit.z);
            } else {
                let t = ((FLOOR_Y - self.cam_pos.y) / -0.032).clamp(0.1, 32.0);
                let hit = self.cam_pos + dir * t;
                ray_hit_xz = Vec2::new(hit.x, hit.z);
            }
        }

        let glow_target;

        if let Some(anchor) = hovered_anchor {
            self.anchor_xz = anchor;
            if !self.has_floor_pos {
                self.free_xz = anchor;
                self.has_floor_pos = true;
            }
            self.anchor_blend.target = 1.0;
            glow_target = 1.0;
            if (1.0 - self.anchor_blend.pos).abs() < 0.005 {
                self.light_state = LightState::LockedObject;
            } else {
                self.light_state = LightState::ToObject;
            }
        } else if ray_hits_floor {
            if !self.has_floor_pos {
                self.free_xz = ray_hit_xz;
                self.has_floor_pos = true;
            } else {
                let lerp_t = (safe_dt * 18.0).clamp(0.0, 1.0);
                self.free_xz = self.free_xz.lerp(ray_hit_xz, lerp_t);
            }
            self.anchor_blend.target = 0.0;
            glow_target = 1.0;
            if self.anchor_blend.pos > 0.005 {
                self.light_state = LightState::ToCursor;
            } else {
                self.light_state = LightState::Cursor;
            }
        } else {
            if pointer_active && self.has_floor_pos {
                let lerp_t = (safe_dt * 10.0).clamp(0.0, 1.0);
                self.free_xz = self.free_xz.lerp(ray_hit_xz, lerp_t);
            }
            self.anchor_blend.target = 0.0;
            glow_target = 0.0;
            if self.cursor_glow.pos < 0.005 {
                self.light_state = LightState::Hidden;
                if !pointer_active {
                    self.has_floor_pos = false;
                }
            } else if self.anchor_blend.pos > 0.005 {
                self.light_state = LightState::ToCursor;
            }
        }

        self.cursor_glow.target = glow_target;
        if snap {
            self.anchor_blend.snap(self.anchor_blend.target);
            self.cursor_glow.snap(glow_target);
        } else {
            self.anchor_blend.step(safe_dt, 78.0, 17.5);
            self.cursor_glow.step(safe_dt, 90.0, 18.0);
        }

        let b = self.anchor_blend.pos.clamp(0.0, 1.0);
        let out_xz = self.free_xz.lerp(self.anchor_xz, b);

        self.cam_buf[16] = out_xz.x;
        self.cam_buf[17] = out_xz.y;
        self.cam_buf[18] = -1.0;
        self.cam_buf[19] = self.cursor_glow.pos.clamp(0.0, 1.0);
    }

    pub fn project_world_point(
        &self,
        world_pos: Vec3,
        size: Vec2,
    ) -> (Vec2, f32) {
        let safe_size = size.max(Vec2::ONE);
        let rel = world_pos - self.cam_pos;

        let cx_cam = rel.dot(self.cam_right);
        let cy_cam = rel.dot(self.cam_up);
        let cz_cam = rel.dot(self.cam_forward).max(1.0);

        let focal = (safe_size.y * 0.5) / TAN_HALF_FOV;
        let proj = focal / cz_cam;
        let screen = Vec2::new(
            safe_size.x * 0.5 + cx_cam * proj,
            safe_size.y * 0.5 - cy_cam * proj,
        );

        (screen, proj)
    }

    pub fn as_ptr(&self) -> *const f32 {
        self.cam_buf.as_ptr()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn basis_matches_reference_trig() {
        for &(yaw, pitch, roll) in &[
            (0.0_f32, -0.14_f32, 0.0_f32),
            (0.082, -0.192, -0.018),
            (-0.058, -0.088, 0.026),
        ] {
            let (sy, cy) = yaw.sin_cos();
            let (sp, cp) = pitch.sin_cos();
            let (sr, cr) = roll.sin_cos();

            let exp_fwd = Vec3::new(sy * cp, sp, cy * cp);
            let r0 = Vec3::new(cy, 0.0, -sy);
            let u0 = Vec3::new(-sp * sy, cp, -sp * cy);
            let exp_right = r0 * cr + u0 * sr;
            let exp_up = -r0 * sr + u0 * cr;

            let (right, up, fwd) =
                GridCamera::basis_from_angles(yaw, pitch, roll);

            assert!((right - exp_right).length() < 1e-6);
            assert!((up - exp_up).length() < 1e-6);
            assert!((fwd - exp_fwd).length() < 1e-6);
        }
    }
}
