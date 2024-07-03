class AddDefaultsForUserHashes < ActiveRecord::Migration[7.0]
  def change
    change_column_default :users, :info, {}
    change_column_default :users, :settings, {}

    User.update_all(info: {}, settings: {})

    change_column_null :users, :info, false
    change_column_null :users, :settings, false
  end
end
