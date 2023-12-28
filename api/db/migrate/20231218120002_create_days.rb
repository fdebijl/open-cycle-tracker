class CreateDays < ActiveRecord::Migration[7.0]
  def change
    create_table :days, id: :uuid do |t|
      t.datetime :date
      t.integer :order
      t.string :day_type

      t.timestamps
    end
  end
end
