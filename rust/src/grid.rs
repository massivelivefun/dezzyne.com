use glam::{EulerRot, Quat, Vec2, Vec3};

use crate::spring::Spring;

pub const CAMERA_FLOATS: usize = 20;
pub const MAJOR_GRID_STEP: f32 = 4.0;
pub const FLOOR_HEIGHT_Y: f32 = -1.55;
pub const TANGENT_HALF_FOV: f32 = 0.58;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum LightState {
    Hidden,
    Cursor,
    ToObject,
    LockedObject,
    ToCursor,
}

pub struct GridCamera {
    camera_position_x: Spring,
    camera_position_y: Spring,
    camera_yaw: Spring,
    camera_pitch: Spring,
    camera_roll: Spring,
    camera_position: Vec3,
    camera_forward: Vec3,
    camera_right: Vec3,
    camera_up: Vec3,
    light_state: LightState,
    has_floor_position: bool,
    free_floor_xz: Vec2,
    anchor_floor_xz: Vec2,
    anchor_blend: Spring,
    cursor_glow: Spring,
    scroll_offset_z: f32,
    release_hold_seconds: f32,
    camera_buffer: [f32; CAMERA_FLOATS],
}

impl GridCamera {
    pub const fn new() -> Self {
        Self {
            camera_position_x: Spring::new(0.0),
            camera_position_y: Spring::new(0.0),
            camera_yaw: Spring::new(0.0),
            camera_pitch: Spring::new(-0.14),
            camera_roll: Spring::new(0.0),
            camera_position: Vec3::ZERO,
            camera_forward: Vec3::Z,
            camera_right: Vec3::X,
            camera_up: Vec3::Y,
            light_state: LightState::Hidden,
            has_floor_position: false,
            free_floor_xz: Vec2::new(0.0, 8.0),
            anchor_floor_xz: Vec2::new(0.0, 4.35),
            anchor_blend: Spring::new(0.0),
            cursor_glow: Spring::new(0.0),
            scroll_offset_z: 0.0,
            release_hold_seconds: 0.0,
            camera_buffer: [0.0; CAMERA_FLOATS],
        }
    }

    pub fn basis_from_angles(
        yaw: f32,
        pitch: f32,
        roll: f32,
    ) -> (Vec3, Vec3, Vec3) {
        let rotation = Quat::from_euler(EulerRot::YXZ, yaw, -pitch, roll);
        (rotation * Vec3::X, rotation * Vec3::Y, rotation * Vec3::Z)
    }

    fn update_camera_targets(
        &mut self,
        delta_seconds: f32,
        safe_viewport: Vec2,
        pointer_position: Vec2,
        pointer_active: bool,
        narrowness: f32,
    ) {
        if pointer_active {
            self.release_hold_seconds = narrowness * 0.50;
            let normalized_pointer = (((pointer_position / safe_viewport)
                - Vec2::splat(0.5))
                * 2.0)
                .clamp(Vec2::NEG_ONE, Vec2::ONE);
            let horizontal_pan_range = 0.52 + narrowness * 1.78;
            let yaw_range = 0.082 + narrowness * 0.178;

            self.camera_position_x.target =
                normalized_pointer.x * horizontal_pan_range;
            self.camera_position_y.target = -normalized_pointer.y * 0.20;
            self.camera_yaw.target = normalized_pointer.x * yaw_range;
            self.camera_pitch.target = -0.14 - normalized_pointer.y * 0.052;
            self.camera_roll.target = -normalized_pointer.x * 0.018;
            return;
        }

        if self.release_hold_seconds > 0.0 {
            self.release_hold_seconds =
                (self.release_hold_seconds - delta_seconds).max(0.0);
            return;
        }

        self.camera_position_x.target = 0.0;
        self.camera_position_y.target = 0.0;
        self.camera_yaw.target = 0.0;
        self.camera_pitch.target = -0.14;
        self.camera_roll.target = 0.0;
    }

    fn apply_camera_springs(
        &mut self,
        delta_seconds: f32,
        pointer_active: bool,
        should_snap: bool,
        narrowness: f32,
    ) {
        if should_snap {
            self.camera_position_x.snap(self.camera_position_x.target);
            self.camera_position_y.snap(self.camera_position_y.target);
            self.camera_yaw.snap(self.camera_yaw.target);
            self.camera_pitch.snap(self.camera_pitch.target);
            self.camera_roll.snap(self.camera_roll.target);
            self.release_hold_seconds = 0.0;
            self.light_state = LightState::Hidden;
            self.has_floor_position = false;
            self.anchor_blend.snap(0.0);
            self.cursor_glow.snap(0.0);
            return;
        }
        if pointer_active || self.release_hold_seconds > 0.0 {
            self.camera_position_x.step(delta_seconds, 62.0, 15.7);
            self.camera_position_y.step(delta_seconds, 62.0, 15.7);
            self.camera_yaw.step(delta_seconds, 58.0, 15.2);
            self.camera_pitch.step(delta_seconds, 58.0, 15.2);
            self.camera_roll.step(delta_seconds, 52.0, 14.4);
            return;
        }

        let pos_stiffness = 24.0 - narrowness * 21.8;
        let pos_damping = 9.8 - narrowness * 6.6;
        let rot_stiffness = 22.0 - narrowness * 20.0;
        let rot_damping = 9.4 - narrowness * 6.3;
        let roll_stiffness = 20.0 - narrowness * 18.2;
        let roll_damping = 8.9 - narrowness * 6.0;

        self.camera_position_x
            .step(delta_seconds, pos_stiffness, pos_damping);
        self.camera_position_y
            .step(delta_seconds, pos_stiffness, pos_damping);
        self.camera_yaw
            .step(delta_seconds, rot_stiffness, rot_damping);
        self.camera_pitch
            .step(delta_seconds, rot_stiffness, rot_damping);
        self.camera_roll
            .step(delta_seconds, roll_stiffness, roll_damping);
    }

    pub fn step_camera(
        &mut self,
        delta_seconds: f32,
        motion_scale: f32,
        viewport_size: Vec2,
        pointer_position: Vec2,
        pointer_active: bool,
        should_snap: bool,
    ) {
        let safe_viewport = viewport_size.max(Vec2::ONE);
        let aspect_ratio = safe_viewport.x / safe_viewport.y;
        let narrowness = ((1.35 - aspect_ratio) / 0.85).clamp(0.0, 1.0);

        self.update_camera_targets(
            delta_seconds,
            safe_viewport,
            pointer_position,
            pointer_active,
            narrowness,
        );
        self.apply_camera_springs(
            delta_seconds,
            pointer_active,
            should_snap,
            narrowness,
        );

        let travel_distance = delta_seconds * 0.85 * motion_scale;
        let next_scroll = self.scroll_offset_z + travel_distance;
        self.scroll_offset_z = next_scroll.rem_euclid(MAJOR_GRID_STEP);

        let (right, up, forward) = Self::basis_from_angles(
            self.camera_yaw.position,
            self.camera_pitch.position,
            self.camera_roll.position,
        );
        self.camera_position = Vec3::new(
            self.camera_position_x.position,
            self.camera_position_y.position,
            0.0,
        );
        self.camera_right = right;
        self.camera_up = up;
        self.camera_forward = forward;

        self.camera_buffer[0] = self.camera_position.x;
        self.camera_buffer[1] = self.camera_position.y;
        self.camera_buffer[2] = self.camera_position.z;
        self.camera_buffer[3] = TANGENT_HALF_FOV;

        self.camera_buffer[4] = forward.x;
        self.camera_buffer[5] = forward.y;
        self.camera_buffer[6] = forward.z;
        self.camera_buffer[7] = self.scroll_offset_z;

        self.camera_buffer[8] = right.x;
        self.camera_buffer[9] = right.y;
        self.camera_buffer[10] = right.z;
        self.camera_buffer[11] = FLOOR_HEIGHT_Y;

        self.camera_buffer[12] = up.x;
        self.camera_buffer[13] = up.y;
        self.camera_buffer[14] = up.z;
        self.camera_buffer[15] = 0.0;
    }

    pub fn screen_ray(
        &self,
        screen_point: Vec2,
        viewport_size: Vec2,
    ) -> (Vec3, Vec3) {
        let safe_viewport = viewport_size.max(Vec2::ONE);
        let half_height = (safe_viewport.y * 0.5).max(1.0);
        let horizontal_tangent =
            ((screen_point.x - safe_viewport.x * 0.5) / half_height)
                * TANGENT_HALF_FOV;
        let vertical_tangent =
            ((safe_viewport.y * 0.5 - screen_point.y) / half_height)
                * TANGENT_HALF_FOV;
        let unnormalized_ray = self.camera_forward
            + self.camera_right * horizontal_tangent
            + self.camera_up * vertical_tangent;
        let ray_direction =
            unnormalized_ray.try_normalize().unwrap_or(self.camera_forward);
        (self.camera_position, ray_direction)
    }

    fn trace_floor_pointer(
        &self,
        viewport_size: Vec2,
        pointer_position: Vec2,
        pointer_active: bool,
    ) -> (bool, Vec2) {
        if !pointer_active {
            return (false, self.free_floor_xz);
        }
        let (ray_origin, ray_direction) =
            self.screen_ray(pointer_position, viewport_size);
        if ray_direction.y < -0.025 {
            let floor_delta = FLOOR_HEIGHT_Y - ray_origin.y;
            let raw_distance = floor_delta / ray_direction.y;
            let intersection_distance = raw_distance.clamp(0.1, 42.0);
            let intersection_point =
                ray_origin + ray_direction * intersection_distance;
            return (
                true,
                Vec2::new(intersection_point.x, intersection_point.z),
            );
        }
        let raw_distance = (FLOOR_HEIGHT_Y - ray_origin.y) / -0.032;
        let intersection_distance = raw_distance.clamp(0.1, 32.0);
        let intersection_point =
            ray_origin + ray_direction * intersection_distance;
        (false, Vec2::new(intersection_point.x, intersection_point.z))
    }

    fn lock_light_to_anchor(&mut self, anchor_position: Vec2) -> f32 {
        self.anchor_floor_xz = anchor_position;
        if !self.has_floor_position {
            self.free_floor_xz = anchor_position;
            self.has_floor_position = true;
        }
        self.anchor_blend.target = 1.0;
        let locked = (1.0 - self.anchor_blend.position).abs() < 0.005;
        self.light_state = if locked {
            LightState::LockedObject
        } else {
            LightState::ToObject
        };
        1.0
    }

    fn track_light_on_floor(
        &mut self,
        delta_seconds: f32,
        ray_floor_xz: Vec2,
    ) -> f32 {
        let interpolation_factor = if self.has_floor_position {
            (delta_seconds * 18.0).clamp(0.0, 1.0)
        } else {
            1.0
        };
        self.free_floor_xz =
            self.free_floor_xz.lerp(ray_floor_xz, interpolation_factor);
        self.has_floor_position = true;
        self.anchor_blend.target = 0.0;
        let returning = self.anchor_blend.position > 0.005;
        self.light_state = if returning {
            LightState::ToCursor
        } else {
            LightState::Cursor
        };
        1.0
    }

    fn update_light_target(
        &mut self,
        delta_seconds: f32,
        pointer_active: bool,
        ray_hits_floor: bool,
        ray_floor_xz: Vec2,
        hovered_anchor: Option<Vec2>,
    ) -> f32 {
        if let Some(anchor_position) = hovered_anchor {
            return self.lock_light_to_anchor(anchor_position);
        }

        if ray_hits_floor {
            return self.track_light_on_floor(delta_seconds, ray_floor_xz);
        }

        if pointer_active && self.has_floor_position {
            let interpolation_factor = (delta_seconds * 10.0).clamp(0.0, 1.0);
            self.free_floor_xz =
                self.free_floor_xz.lerp(ray_floor_xz, interpolation_factor);
        }
        self.anchor_blend.target = 0.0;
        if self.cursor_glow.position < 0.005 {
            self.light_state = LightState::Hidden;
            self.has_floor_position &= pointer_active;
            return 0.0;
        }
        if self.anchor_blend.position > 0.005 {
            self.light_state = LightState::ToCursor;
        }
        0.0
    }

    pub fn step_cursor_light(
        &mut self,
        delta_seconds: f32,
        viewport_size: Vec2,
        pointer_position: Vec2,
        pointer_active: bool,
        hovered_anchor: Option<Vec2>,
        should_snap: bool,
    ) {
        let (ray_hits_floor, ray_floor_xz) = self.trace_floor_pointer(
            viewport_size,
            pointer_position,
            pointer_active,
        );
        let glow_target = self.update_light_target(
            delta_seconds,
            pointer_active,
            ray_hits_floor,
            ray_floor_xz,
            hovered_anchor,
        );

        self.cursor_glow.target = glow_target;
        if should_snap {
            self.anchor_blend.snap(self.anchor_blend.target);
            self.cursor_glow.snap(glow_target);
        } else {
            self.anchor_blend.step(delta_seconds, 78.0, 17.5);
            self.cursor_glow.step(delta_seconds, 90.0, 18.0);
        }

        let blend_factor = self.anchor_blend.position.clamp(0.0, 1.0);
        let output_floor_xz =
            self.free_floor_xz.lerp(self.anchor_floor_xz, blend_factor);

        self.camera_buffer[16] = output_floor_xz.x;
        self.camera_buffer[17] = output_floor_xz.y;
        self.camera_buffer[18] = -1.0;
        self.camera_buffer[19] = self.cursor_glow.position.clamp(0.0, 1.0);
    }

    pub fn project_world_point(
        &self,
        world_position: Vec3,
        viewport_size: Vec2,
    ) -> (Vec2, f32) {
        let safe_viewport = viewport_size.max(Vec2::ONE);
        let camera_relative = world_position - self.camera_position;

        let camera_x = camera_relative.dot(self.camera_right);
        let camera_y = camera_relative.dot(self.camera_up);
        let camera_depth = camera_relative.dot(self.camera_forward).max(1.0);

        let focal_length = (safe_viewport.y * 0.5) / TANGENT_HALF_FOV;
        let projection_scale = focal_length / camera_depth;
        let screen_position = Vec2::new(
            safe_viewport.x * 0.5 + camera_x * projection_scale,
            safe_viewport.y * 0.5 - camera_y * projection_scale,
        );

        (screen_position, projection_scale)
    }

    pub fn as_pointer(&self) -> *const f32 {
        self.camera_buffer.as_ptr()
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
            let (yaw_sine, yaw_cosine) = yaw.sin_cos();
            let (pitch_sine, pitch_cosine) = pitch.sin_cos();
            let (roll_sine, roll_cosine) = roll.sin_cos();

            let expected_forward = Vec3::new(
                yaw_sine * pitch_cosine,
                pitch_sine,
                yaw_cosine * pitch_cosine,
            );
            let unrolled_right = Vec3::new(yaw_cosine, 0.0, -yaw_sine);
            let unrolled_up = Vec3::new(
                -pitch_sine * yaw_sine,
                pitch_cosine,
                -pitch_sine * yaw_cosine,
            );
            let expected_right =
                unrolled_right * roll_cosine + unrolled_up * roll_sine;
            let expected_up =
                -unrolled_right * roll_sine + unrolled_up * roll_cosine;

            let (right, up, forward) =
                GridCamera::basis_from_angles(yaw, pitch, roll);

            assert!((right - expected_right).length() < 1e-6);
            assert!((up - expected_up).length() < 1e-6);
            assert!((forward - expected_forward).length() < 1e-6);
        }
    }
}
