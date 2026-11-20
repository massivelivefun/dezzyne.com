mod engine;
mod grid;
mod portal;
mod spring;

use crate::engine::state;

#[no_mangle]
pub extern "C" fn init_scene(
    width: f32,
    height: f32,
    portal_enabled: u32,
    rng_seed: u32,
) {
    state().init(width, height, portal_enabled, rng_seed);
}

#[no_mangle]
pub extern "C" fn resize_scene(width: f32, height: f32) {
    state().resize(width, height);
}

#[no_mangle]
pub extern "C" fn pointer_move(x: f32, y: f32) {
    state().pointer_move(x, y);
}

#[no_mangle]
pub extern "C" fn pointer_leave() {
    state().pointer_leave();
}

#[no_mangle]
pub extern "C" fn click_portal(x: f32, y: f32) -> u32 {
    state().click_portal(x, y)
}

#[no_mangle]
pub extern "C" fn is_portal_hovered() -> u32 {
    if state().portal.is_hovered() {
        1
    } else {
        0
    }
}

#[no_mangle]
pub extern "C" fn step_scene(dt: f32, motion_scale: f32) -> u32 {
    state().step(dt, motion_scale)
}

#[no_mangle]
pub extern "C" fn get_instance_id() -> u32 {
    state().portal.instance_id()
}

#[no_mangle]
pub extern "C" fn get_player_count() -> u32 {
    state().portal.player_count()
}

#[no_mangle]
pub extern "C" fn get_countdown_sec() -> u32 {
    state().portal.countdown_sec()
}

#[no_mangle]
pub extern "C" fn get_camera_ptr() -> *const f32 {
    state().grid.as_ptr()
}

#[no_mangle]
pub extern "C" fn get_portal_ptr() -> *const f32 {
    state().portal.portal_ptr()
}

#[no_mangle]
pub extern "C" fn get_rings_ptr() -> *const f32 {
    state().portal.rings_ptr()
}

#[no_mangle]
pub extern "C" fn get_particles_ptr() -> *const f32 {
    state().portal.particles_ptr()
}

#[no_mangle]
pub extern "C" fn get_particle_count() -> usize {
    state().portal.particle_count()
}
