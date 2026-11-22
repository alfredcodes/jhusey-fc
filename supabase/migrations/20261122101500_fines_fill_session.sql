-- A late fine's session is its attendance row's session. Fill it in when the
-- inserting code only gives the attendance id, and refuse a mismatch.
create function public.fines_fill_session()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_session uuid;
begin
  if new.attendance_id is not null then
    select session_id into v_session from public.attendance where id = new.attendance_id;
    if new.session_id is null then
      new.session_id := v_session;
    elsif new.session_id is distinct from v_session then
      raise exception 'A late fine must belong to its attendance''s session.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger fines_fill_session
  before insert on public.fines
  for each row execute function public.fines_fill_session();

revoke execute on function public.fines_fill_session() from public, anon, authenticated;
